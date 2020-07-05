import { log } from "./logger";
import * as Runtime from "./Runtime";

import {SDParser} from "./SDParser";

/*
const header = Memory.alloc(16);
header
    .writeU32(0xdeadbeef).add(4)
    .writeU32(0xd00ff00d).add(4)
    .writeU64(uint64("0x1122334455667788"));
log(hexdump(header.readByteArray(16) as ArrayBuffer, { ansi: true }));

Process.getModuleByName("libSystem.B.dylib")
    .enumerateExports()
    .slice(0, 16)
    .forEach((exp, index) => {
        log(`export ${index}: ${exp.name}`);
    });

Interceptor.attach(Module.getExportByName(null, "open"), {
    onEnter(args) {
        const path = args[0].readUtf8String();
        log(`open() path="${path}"`);
    }
});
*/

log("--- loaded ---");
Runtime.initHook();

/*
const mainExe = Module.findBaseAddress('TestSwiftRuntime');
log('mainExe ' + mainExe)

// hook Swift function: func testStruct(_ info: XInfo)
Interceptor.attach(mainExe!.add(0x00030FFC), {
  onEnter(args) {
    const ptr = args[0]; // pointer to XInfo instance
    const typeAddrPtr = ptr.add(-24); // x64=0x18=24, arm=0x40=64
    const typeAddr = typeAddrPtr.readPointer();
    log(
      `[Hook Func] arg ptr=${ptr}, typeAddrPtr=${typeAddrPtr}, typeAddr=${typeAddr}`
    );
    console.log("arg ptr->", hexdump(ptr, { offset: 0, length: 64 })); 
    log("") 


    //const mypt = typeAddr.add(-24);
    //log(`mypt ${mypt}`)
    console.log("typeAddrPtr->", hexdump(typeAddrPtr, { offset: 0, length: 64 })); 

    console.log("typeAddr->", hexdump(typeAddr, { offset: 0, length: 64 }));
  },
});
*/


function getMainModule():Module|null {
    let exePath = ObjC.classes.NSBundle.mainBundle().executablePath() as string;
    let modules = Process.enumerateModules();
    for (var i = 0; i < modules.length; i++) {
        let oneModule = modules[i];
        if (oneModule.path == exePath) {
            return oneModule;
        }
    }
    return null;
}

let mainModule = getMainModule();
if (mainModule) {
    log('main module path ' + mainModule.path)
    log('main module base ' + mainModule.base)
    if (Runtime.isSwiftAvailable()) {
        let parser = new SDParser(mainModule);
        parser.parseSwiftType();
        parser.dumpAll();
    } else {
        log('swift is NOT available');
    }
    
} else {
    log('fail to find main module');
}

