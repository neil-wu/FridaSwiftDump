
import {SDContextDescriptorFlags, SDContextDescriptorKind, getKindDesc} from "./SDContextDescriptorFlags";

export class SDNominalObjField {
    name: string = "";
    type: string = "";
    
    typePtr: NativePointer = new NativePointer(0);
}

export class SDNominalObj {
    contextDescriptorFlag: SDContextDescriptorFlags|null = null;
    typeName: string = "";
    fields: SDNominalObjField[] = [];
    nominalOffset: number = 0;
    mangledTypeName: string = "";
    superClassName: string = "";
    protocols:string[] = [];

    getKindDesc():string {
        var kind:SDContextDescriptorKind = SDContextDescriptorKind.Unknow;
        if (this.contextDescriptorFlag) {
            kind = this.contextDescriptorFlag.getKind();
        }
        return getKindDesc(kind);
    }

    dumpDefine(): string {
        let intent: string = "    ";
        var str: string = "";
        var kind:SDContextDescriptorKind = SDContextDescriptorKind.Unknow;
        if (this.contextDescriptorFlag) {
            kind = this.contextDescriptorFlag.getKind();
        }
        let kindDesc: string = this.getKindDesc();
        str += `${kindDesc} ` + this.typeName;
        if (this.superClassName.length > 0) {
            str += " : " + this.superClassName;
        }
        if (this.protocols.length > 0) {
            let superStr: string = this.protocols.join(",");
            let tmp: string = this.superClassName.length <= 0 ? " : " : "";
            str += tmp + superStr;
        }
        str += " {\n";
        
        //str += intent + "\n";//+ `//${contextDescriptorFlag}\n`;
        for (var i = 0;i < this.fields.length; i++) {
            let field = this.fields[i];
            var fs: string = intent;
            if (kind == SDContextDescriptorKind.Enum ) {
                if (field.type.length <= 0) {
                    fs += `case ${field.name}\n`; // without payload
                } else {
                    let tmp = field.type.startsWith("(") ? field.type : "(" + field.type + ")";
                    fs += `case ${field.name}${tmp}\n`; // enum with payload
                }
            } else {
                fs += `let ${field.name}: ${field.type};\n`;
            }
            str += fs;
        }
        str += "}\n";
        
        return str;
    }
}
