import { log } from "./logger";
import * as Runtime from "./Runtime";
import {SDContextDescriptorFlags, SDContextDescriptorKind, getKindDesc} from "./SDContextDescriptorFlags";
import {SDNominalObj, SDNominalObjField} from "./SDNominalObj";
import { ESection, ESegment } from "./Consts";
import * as Util from "./Util";



export class SDParser {
    targetModule:Module
    
    cacheNominalAddressMap: {[key: string]: string} = {}; // address_str -> NameString
    mangledNameMap:{[key: string]: string} = {}; // MangledName : TypeName
    nominalObjs:SDNominalObj[] = [];

    constructor(module: Module) {
        this.targetModule = module;

        this.mangledNameMap = {"0x02f36d": "Int32",
        "0x02cd6d": "Int16", "0x027b6e": "UInt16",
        "0x022b6c": "UInt32",
        "0x02b98502": "Int64", "0x02418a02" : "UInt64",
        "0x02958802": "CGFloat"};
        
    }

    parseSwiftType() {
        let [ptrSection, sectionSize] = Runtime.getSectionData(this.targetModule, ESection.swift5types, ESegment.TEXT);
        log(`ptrSection ${ptrSection}, sectionSize ${sectionSize}`);
        
        const UniqueNominalTypeDescriptor = 4;
        // __swift5_types is 4 bytes
        for (let index = 0; index < sectionSize; index = index + 4) {
            let ptr = ptrSection.add(index);
            
            let nominalArchOffset = ptr.readS32();
            let nominalPtr = ptr.add(nominalArchOffset);
            
            // ref: https://knight.sc/reverse%20engineering/2019/07/17/swift-metadata.html
            let flags = nominalPtr.readU32();
            let sdfObj = new SDContextDescriptorFlags(flags);
            let type = sdfObj.getKind(); // SDContextDescriptorFlags

            let parentVal = nominalPtr.add(4).readS32();

            let namePtr = readMove(nominalPtr.add(8));
            let nameStr = namePtr.readUtf8String();

            //let accessFunctionVal = nominalPtr.add(12).readS32();
            
            let obj = new SDNominalObj();
            obj.typeName = nameStr ?? "";
            obj.contextDescriptorFlag = sdfObj;
            obj.nominalOffset = nominalArchOffset;
            this.nominalObjs.push(obj);
            
            if (nameStr) {
                let addressStr = '0x' + nominalPtr.toString(16);
                this.cacheNominalAddressMap[addressStr] = nameStr;
            }
            if (sdfObj.getKind() == SDContextDescriptorKind.Class) {
                obj.superClassName = this.resolveSuperClassName(nominalPtr);
            }
            
            // in swift5_filedmd
            //let fieldDescriptorPtr = readMove(nominalPtr.add(4 * 4)); 
            let fdp1 =  nominalPtr.add(4 * 4);
            
            let fdp1Buf = fdp1.readByteArray(64);

            let fdp1_val = fdp1.readS32();
            
            let fieldDescriptorPtr = fdp1.add(fdp1_val)
            let mangledTypeName = Util.readUCharHexString(fieldDescriptorPtr); // readCString will fail!!!
            
            if (mangledTypeName && mangledTypeName.length > 0) {
                obj.mangledTypeName = mangledTypeName;
                this.mangledNameMap[obj.mangledTypeName] = obj.typeName;
            }
            //log(`${index} -> ${ptr} , offset ${offset}, ${nominalPtr}, flags ${flags}, ${type}, name ${nameStr}`);
            let fields:SDNominalObjField[] = dumpFieldDescriptor(fieldDescriptorPtr, mangledTypeName.length == 0);
            obj.fields = fields;
        }
        
    }

    dumpAll() {
        var statistics:{[key: string]: number} = {};
        for (var i = 0; i < this.nominalObjs.length; i++) {
            let obj = this.nominalObjs[i];
            obj.typeName = Runtime.swift_demangle(obj.typeName);

            //count num
            let kindDesc = obj.getKindDesc();
            let kindNum = statistics[kindDesc];
            if (kindNum) {
                statistics[kindDesc] = kindNum + 1;
            } else {
                statistics[kindDesc] = 1;
            }

            // resole field type name
            for (var k = 0; k < obj.fields.length; k++) {
                let field = obj.fields[k];
                let ft: string = field.type;
                if (ft.startsWith('0x')) {
                    let fixName = this.mangledNameMap[ft];
                    if (fixName && fixName.length > 0) {
                        field.type = fixName;
                    } else {
                        field.type = this.fixMangledName(ft, field.typePtr);
                    }
                } else {
                    let checkName = "$s" + ft;
                    let tmp = Runtime.swift_demangle(checkName);
                    if (tmp != checkName) {
                        field.type = tmp;
                    }
                }
            }

            log(`${obj.dumpDefine()}`)
        }

        log(`\n[statistics]:`);
        for (const key in statistics) {
            log(`${key}  ${statistics[key]}`);
        }
    }

    resolveSuperClassName(nominalPtr: NativePointer): string {
        let ptr = nominalPtr.add(4 * 5);
        let superClassTypeVal = ptr.readS32();
        let superClassRefPtr = ptr.add(superClassTypeVal);
        let superRefStr = Util.readUCharHexString(superClassRefPtr);
        if (superRefStr.length <= 0) {
            return "";
        }
        var retName:string = "";
        if (superRefStr.startsWith("0x")) {
            let cacheName = this.mangledNameMap[superRefStr]
            if (cacheName && cacheName.length > 0) {
                retName = cacheName;
            } else {
                retName = superRefStr;
            }
        } else {
            retName = superRefStr; // resolve later
        }
        return retName;
    }

    fixMangledName(typeName: string, startPtr: NativePointer):string {
        if (!typeName.startsWith('0x')) {
            return typeName;
        }
        let typeNameArray = Util.hexStrToUIntArray(typeName);
        //log(`[fixMangledName] ${typeName} -> ${ typeNameArray }`)

        var mangledName: string = "";
        var i = 0;

        while(i < typeNameArray.length) {
            let val = typeNameArray[i];
            let valStr = String.fromCharCode(val); 
            if (val == 0x01) {
                let fromIdx:number = i + 1;
                let toIdx:number = i + 5;
                if (toIdx > typeNameArray.length) {
                    mangledName = mangledName + valStr;
                    i = i + 1;
                    continue;
                }
                let offsetArray = typeNameArray.slice(fromIdx, toIdx);
                let tmpPtr = startPtr.add(fromIdx);
                let result:string = this.resoleSymbolicRefDirectly(offsetArray, tmpPtr);
                if (i == 0 && toIdx >= typeNameArray.length) {
                    mangledName = mangledName + result; // use original result
                } else {
                    let fixName = this.makeDemangledTypeName(result, "")
                    mangledName = mangledName + fixName;
                }
                i = i + 5;
            } else if (val == 0x02) {//indirectly
                let fromIdx = i + 1; // ignore 0x02
                let toIdx = ((i + 4) > typeNameArray.length) ? ( i + (typeNameArray.length - i) ) : (i + 4); // 4 bytes
                let offsetArray = typeNameArray.slice(fromIdx, toIdx);
                let tmpPtr = startPtr.add(fromIdx);
                let result = this.resoleSymbolicRefIndirectly(offsetArray, tmpPtr);
                if (i == 0 && toIdx >= typeNameArray.length) {
                    mangledName = mangledName + result;
                } else {
                    let fixName = this.makeDemangledTypeName(result, mangledName)
                    mangledName = mangledName + fixName
                }
                i = toIdx + 1;
            } else {
                //check next
                mangledName = mangledName + valStr;
                i = i + 1;
            }

        }

        let retName = Runtime.swift_demangle(mangledName)
        //log(`[fixMangledName]    result: ${mangledName} -> ${ retName }`)
        return retName;
    }


    makeDemangledTypeName(type: string, header: string):string {
        let isArray:boolean = header.indexOf("Say") >= 0 || header.indexOf("SDy") >= 0;
        let suffix: String = isArray ? "G" : "";
        let fixName = `So${type.length}${type}C` + suffix;
        return fixName;
    }

    resoleSymbolicRefDirectly(offsetArray: number[], ptr: NativePointer) {
        //4 bytes
        let hexStr = Util.uintArrayToHexStr(offsetArray.reverse());
        let address = parseInt(hexStr);
        let nominalArchPtr = overflowAdd(ptr, address);
        let addressStr = '0x' + nominalArchPtr.toString(16);
        
        //log(`resoleSymbolicRefDirectly input ${offsetArray}, ptr ${ptr}, ${hexStr} -> address ${address}, ${nominalArchPtr} -> ${valstr}`)

        let nominalName = this.cacheNominalAddressMap[addressStr];
        if (nominalName && nominalName.length > 0) {
            //log(`resoleSymbolicRefDirectly input ${offsetArray}, ptr ${ptr}, ${hexStr}, ${nominalName}`);
            return nominalName;
        } else {
            return Util.uintArrayToHexStr(offsetArray);
        }
    }

    resoleSymbolicRefIndirectly(offsetArray: number[], ptr: NativePointer) {

        let hexStr = Util.uintArrayToHexStr(offsetArray.reverse());
        let address = parseInt(hexStr);
        let addrPtr = overflowAdd(ptr, address);
        
        let addrVal = addrPtr.readU64()
        let addrValStr = '0x' + addrVal.toString(16)
        
        //log(`resoleSymbolicRefIndirectly input ${offsetArray}, ptr ${ptr}, ${hexStr}, addrPtr ${addrPtr}, val=${addrValStr}`);

        let nominalName = this.cacheNominalAddressMap[addrValStr];
        if (nominalName && nominalName.length > 0) {
            return nominalName;
        } else {
            return Util.uintArrayToHexStr(offsetArray);
        }
    }
    
} // end SDParser


function overflowAdd(ptr:NativePointer, add:number):NativePointer {
    let mask = 0xFFFFFFFF;
    let low32Ptr = ptr.and(mask);
    let highPtr = ptr.sub(low32Ptr);
    
    let tmp = low32Ptr.add(add).and(mask)

    return tmp.add(highPtr);
}

function dumpFieldDescriptor(fieldDescriptorPtr: NativePointer, ignoreMangledTypeName:boolean):SDNominalObjField[] {
    //swift5_filedmd, FieldDescriptor
    let startOffset = 4; //ignoreMangledTypeName ? 0 : 4;
    let numFields = fieldDescriptorPtr.add(startOffset + 4 + 2 + 2).readU32();
    if (0 === numFields) {
        return [];
    }
    if (numFields > 1000) {
        log(`[dumpFieldDescriptor] ${numFields} too many fields, may be unhandled format`);
        return [];
    }
    let ret:SDNominalObjField[] = [];
    //log(`    numFields ${numFields}`);
    var fieldStart = fieldDescriptorPtr.add(startOffset + 4 + 2 + 2 + 4);
    for (var i = 0; i < numFields; i++) {
        let filedAddr = fieldStart.add( i * (4 * 3) );
        let typePtr = readMove( filedAddr.add(4) )
        var typeName = "";

        try {
            typeName = typePtr.readCString() ?? "";
        } catch (error) {
            //log(`      ${i} fail to get typeName, error ${error}, typePtr = ${typePtr}`);
            //log(hexdump(typePtr.readByteArray(32) as ArrayBuffer, { ansi: true }));

        }
        //log(`      field ${i}, ${typeName}, ${typePtr}`);

        if (!Util.isPrintableString(typeName)) {
            typeName = Util.readUCharHexString(typePtr);
        } 
        let fieldPtr = readMove( filedAddr.add(8) );
        var fieldName = "";
        try {
            fieldName = fieldPtr.readCString() ?? "";
        } catch (error) {
            //log(`      ${i} error ${error}`);
        }
        //log(`      field ${i}, ${typeName}, ${fieldName}`);
        
        let obj = new SDNominalObjField();
        obj.name = fieldName ?? "";
        obj.type = typeName ?? "";
        obj.typePtr = typePtr;
        ret.push(obj);
    }
    
    return ret;
}


function readMove(ptr: NativePointer):NativePointer {
    return ptr.add(ptr.readS32());
}







