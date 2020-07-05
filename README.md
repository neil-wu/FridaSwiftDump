
#### FridaSwiftDump

FridaSwiftDump a Frida tool for retriving the Swift Object info from an running app. 

It's the Frida version of my Mac OS command-line tool [SwiftDump](https://github.com/neil-wu/SwiftDump/).

You can either use`SwiftDump` for a Mach-O file or `FridaSwiftDump` for a foreground running app.

Check [SwiftDump](https://github.com/neil-wu/SwiftDump/) for more details.


#### Usage

1. build frida-agent
2. frida -UF -l ./frida-agent/_agent.js


#### TODO

Currently FridaSwiftDump does not parse swift protocol! 

#### License

MIT

