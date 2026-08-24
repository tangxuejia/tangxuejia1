import { DeviceError } from "../dsh-core/contracts";
import type { DeviceCapabilities, DeviceInfo, DeviceLayer, ProcessHandle } from "../dsh-core/contracts";

export interface HuaweiBridge {
  getInfo(): Promise<DeviceInfo>;
  getCapabilities(): Promise<DeviceCapabilities>;
  openWorkspace(path: string): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  startProcess(command: string, args: string[]): Promise<ProcessHandle>;
}

export class HuaweiDeviceLayer implements DeviceLayer {
  constructor(private readonly bridge?: HuaweiBridge) {}
  async getInfo(): Promise<DeviceInfo> { if (this.bridge) return this.bridge.getInfo(); return { platform:"openharmony", model:"unknown", osVersion:"unknown", architecture:"unknown" }; }
  async getCapabilities(): Promise<DeviceCapabilities> { if (this.bridge) return this.bridge.getCapabilities(); return { filesystem:true, process:false, network:true, notifications:false }; }
  async openWorkspace(path: string): Promise<void> { if (this.bridge) return this.bridge.openWorkspace(path); throw new DeviceError("BRIDGE_UNAVAILABLE","Huawei workspace bridge is unavailable: "+path); }
  async readFile(path: string): Promise<Uint8Array> { if (this.bridge) return this.bridge.readFile(path); throw new DeviceError("BRIDGE_UNAVAILABLE","Huawei file bridge is unavailable: "+path); }
  async writeFile(path: string, data: Uint8Array): Promise<void> { if (this.bridge) return this.bridge.writeFile(path,data); throw new DeviceError("BRIDGE_UNAVAILABLE","Huawei file bridge is unavailable: "+path); }
  async startProcess(command: string, args: string[] = []): Promise<ProcessHandle> { if (this.bridge) return this.bridge.startProcess(command,args); throw new DeviceError("BRIDGE_UNAVAILABLE","Huawei process bridge is unavailable: "+command); }
}
