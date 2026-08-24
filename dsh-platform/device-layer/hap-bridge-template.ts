import type { ProcessHandle,DeviceCapabilities,DeviceInfo } from "../dsh-core/contracts";
import type { ArchiveBridge } from "../runtime/workspace-transfer";
import type { HuaweiBridge } from "./huawei-device-layer";
import type { HapRuntimeCallbacks,RuntimeHostAdapter } from "./hap-runtime-adapter";
export interface HapNativeCallbacks extends HapRuntimeCallbacks {
  getDeviceInfo():Promise<DeviceInfo>; getDeviceCapabilities():Promise<DeviceCapabilities>; openWorkspace(path:string):Promise<void>;
  readSandboxFile(path:string):Promise<Uint8Array>; writeSandboxFile(path:string,data:Uint8Array):Promise<void>;
  spawnLocalProcess(command:string,args:string[]):Promise<ProcessHandle>; extractZip(sourcePath:string,destinationPath:string):Promise<void>; createZip(sourcePath:string,targetPath:string):Promise<void>;
}
export class HapBridgeTemplate implements HuaweiBridge,ArchiveBridge,RuntimeHostAdapter {
  constructor(private readonly native:HapNativeCallbacks){}
  getInfo(){return this.native.getDeviceInfo();} getCapabilities(){return this.native.getDeviceCapabilities();} openWorkspace(path:string){return this.native.openWorkspace(path);}
  readFile(path:string){return this.native.readSandboxFile(path);} writeFile(path:string,data:Uint8Array){return this.native.writeSandboxFile(path,data);}
  startProcess(command:string,args:string[]){return this.native.spawnLocalProcess(command,args);} extract(sourcePath:string,destinationPath:string){return this.native.extractZip(sourcePath,destinationPath);}
  compress(sourcePath:string,targetPath:string){return this.native.createZip(sourcePath,targetPath);} install(runtimeZipPath:string,runtimeRoot:string,version:string){return this.native.installRuntime(runtimeZipPath,runtimeRoot,version);}
  startNode(argv:string[]){return this.native.startEmbeddedNode(argv);}
}
