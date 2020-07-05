import { log } from "./logger";
import * as Runtime from "./Runtime";
import {SDParser} from "./SDParser";



log("--- loaded ---");

Runtime.initHook();

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

