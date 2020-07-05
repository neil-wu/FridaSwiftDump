
export enum SDContextDescriptorKind {
    /// This context descriptor represents a module.
    Module = 0,
    
    /// This context descriptor represents an extension.
    Extension = 1,
    
    /// This context descriptor represents an anonymous possibly-generic context
    /// such as a function body.
    Anonymous = 2,
    
    /// This context descriptor represents a protocol context.
    SwiftProtocol = 3,
    
    /// This context descriptor represents an opaque type alias.
    OpaqueType = 4,
    
    /// First kind that represents a type of any sort.
    //Type_First = 16,
    
    /// This context descriptor represents a class.
    Class = 16, // Type_First
    
    /// This context descriptor represents a struct.
    Struct = 17, // Type_First + 1
    
    /// This context descriptor represents an enum.
    Enum = 18, // Type_First + 2
    
    /// Last kind that represents a type of any sort.
    Type_Last = 31,
    
    Unknow = 0xFF // It's not in swift source, this value only used for dump
}

export class SDContextDescriptorFlags {
    value: number; // UInt32;
    constructor(val: number) {
        this.value = val;
    }
    /// The kind of context this descriptor describes.
    getKind():SDContextDescriptorKind {
        // SDContextDescriptorKind
        let tmp = this.value & 0x1F;

        switch(tmp) {
            case SDContextDescriptorKind.Module: return SDContextDescriptorKind.Module;
            case SDContextDescriptorKind.Extension: return SDContextDescriptorKind.Extension;
            case SDContextDescriptorKind.Anonymous: return SDContextDescriptorKind.Anonymous;
            case SDContextDescriptorKind.SwiftProtocol: return SDContextDescriptorKind.SwiftProtocol;
            case SDContextDescriptorKind.OpaqueType: return SDContextDescriptorKind.OpaqueType;
            case SDContextDescriptorKind.Class: return SDContextDescriptorKind.Class;
            case SDContextDescriptorKind.Struct: return SDContextDescriptorKind.Struct;
            case SDContextDescriptorKind.Enum: return SDContextDescriptorKind.Enum;
        }
        return SDContextDescriptorKind.Unknow;
    }

    /// Whether the context being described is generic.
    isGeneric() {
        return (this.value & 0x80) != 0;
    }
    /// Whether this is a unique record describing the referenced context.
    isUnique() {
        return (this.value & 0x40) != 0;
    }

    /// The format version of the descriptor. Higher version numbers may have
    /// additional fields that aren't present in older versions.
    getVersion() {
        return (this.value >> 8) & 0xFF;
    }
    /// The most significant two bytes of the flags word, which can have
    /// kind-specific meaning.
    getKindSpecificFlags() {
        return (this.value >> 16) & 0xFFFF;
    }

}

export function getKindDesc(kind: SDContextDescriptorKind) {
    switch(kind) {
        case SDContextDescriptorKind.Module: return "module";
        case SDContextDescriptorKind.Extension: return "extension";
        case SDContextDescriptorKind.Anonymous: return "anonymous";
        case SDContextDescriptorKind.SwiftProtocol: return "protocol";
        case SDContextDescriptorKind.OpaqueType: return "opaqueType";
        case SDContextDescriptorKind.Class: return "class";
        case SDContextDescriptorKind.Struct: return "struct";
        case SDContextDescriptorKind.Enum: return "enum";
    }
    return "unknow"
}


