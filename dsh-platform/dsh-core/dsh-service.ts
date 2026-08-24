import type { DeviceInfo, DshRuntime } from "./contracts";
export type DshStatus="idle"|"initializing"|"ready"|"stopped"|"error";
export interface DshSnapshot { status:DshStatus; device?:DeviceInfo; error?:string; }
export class DshService {
  private snapshot:DshSnapshot={status:"idle"};
  constructor(private readonly runtime:DshRuntime){}
  getSnapshot(){return {...this.snapshot};}
  getRuntimeDeviceLayer(){return this.runtime.getDeviceLayer();}
  async start():Promise<DshSnapshot>{this.snapshot={status:"initializing"};try{await this.runtime.initialize();const device=await this.runtime.getDeviceLayer().getInfo();this.snapshot={status:"ready",device};}catch(error){this.snapshot={status:"error",error:error instanceof Error?error.message:String(error)};}return this.getSnapshot();}
  async stop():Promise<DshSnapshot>{await this.runtime.shutdown();this.snapshot={status:"stopped"};return this.getSnapshot();}
}
