import { log } from "./logger";
import { ESection, ESegment } from "./Consts";
import * as Util from "./Util";

let size_t = Process.pointerSize === 8 ? 'uint64' : Process.pointerSize === 4 ? 'uint32' : "unsupported platform";


var _swift_demangle:NativeFunction
var _free:NativeFunction
var _getsectiondata:NativeFunction

// https://github.com/maltek/swift-frida/blob/495eed2a5acc365e0b741995901f3cba6927b239/runtime-api.js

function isSwiftAvailable():boolean {
    let tmp = Module.findBaseAddress("libswiftCore.dylib");
    return (tmp != null)
}


function initHook() {
    log('[Runtime] initHook...');
    //1. swift_demangle
    if (isSwiftAvailable()) {
        const addr_swift_demangle = Module.getExportByName("libswiftCore.dylib", "swift_demangle");
        _swift_demangle = new NativeFunction(addr_swift_demangle, "pointer", [
            "pointer",size_t,"pointer", "pointer", 'int32' ]);
        log(`[Runtime] hook swift_demangle ${addr_swift_demangle} -> ${_swift_demangle}`);
    } else {
        log(`[Runtime] fail to find swift_demangle, swift is not avaliable`);
    }

    //2. free
    const addr_free = Module.getExportByName("libsystem_malloc.dylib", "free");
    _free = new NativeFunction(addr_free, "void", ["pointer"]);
    log(`[Runtime] hook free ${addr_free} -> ${_free}`);

    //3. 
    const addr_getsectiondata = Module.getExportByName("libmacho.dylib", "getsectiondata");
    _getsectiondata = new NativeFunction(addr_getsectiondata, "pointer", [
      "pointer","pointer", "pointer","pointer",]);
    log(`addr_getsectiondata ${addr_getsectiondata} -> ${_getsectiondata}`);
}


function swift_demangle(name: string) {
    if (!_swift_demangle) {
        return name;
    }

    var fixname: string = name;
    if (name.startsWith("$s") || name.startsWith("_T")) {
        fixname = name;
    } else if (name.startsWith("So")) {
        fixname = "$s" + name;
    } else if (Util.isPrintableString(name)) {
        fixname = "$s" + name;
    } else {
        return name;
    }
    

    let cStr = Memory.allocUtf8String(fixname);
    let demangled = _swift_demangle(cStr, fixname.length, ptr(0), ptr(0), 0) as NativePointer;
    let res: string|null = null;
    if (demangled) {
        res = demangled.readUtf8String();
        _free(demangled);
    }
    if (res && res != fixname) {
        return res;
    }
    return name; // original string
}

function getSectionData(module:Module, sect:ESection, seg:ESegment):[NativePointer, number|UInt64] {
    
    const segName = Memory.allocUtf8String(seg);
    const sectName = Memory.allocUtf8String(sect);
    let sizeAlloc = Memory.alloc(8);

    let ptrSection = _getsectiondata(module.base, segName, sectName, sizeAlloc) as NativePointer;
    let sectionSize = sizeAlloc.readULong();
    // [string, number]
    return [ptrSection, sectionSize];
}


export {
    isSwiftAvailable,
    initHook,
    swift_demangle,
    getSectionData,
}


//api.free(demangled);

