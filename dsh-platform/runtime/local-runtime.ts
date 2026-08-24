import type { DeviceLayer,DshRuntime } from "../dsh-core/contracts";
export class LocalRuntime implements DshRuntime {
  private initialized=false;
  constructor(private readonly deviceLayer:DeviceLayer){}
  async initialize():Promise<void>{if(this.initialized)return;await this.deviceLayer.getCapabilities();this.initialized=true;}
  async shutdown():Promise<void>{this.initialized=false;}
  getDeviceLayer():DeviceLayer{return this.deviceLayer;}
}
