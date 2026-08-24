import type { DeviceLayer, ProcessHandle } from "../dsh-core/contracts";

export type ProcessState = "stopped" | "starting" | "running" | "failed";
export interface ProcessSnapshot { state: ProcessState; id?: string; error?: string; }

export class DshProcessSupervisor {
  private handle?: ProcessHandle;
  private snapshot: ProcessSnapshot = { state:"stopped" };
  constructor(private readonly deviceLayer: DeviceLayer) {}
  getSnapshot(): ProcessSnapshot { return {...this.snapshot}; }
  async start(command:string,args:string[]=[]):Promise<ProcessSnapshot> {
    if (this.handle && await this.handle.isRunning()) return this.getSnapshot();
    this.snapshot={state:"starting"};
    try { this.handle=await this.deviceLayer.startProcess(command,args); this.snapshot={state:"running",id:this.handle.id}; }
    catch(error) { this.handle=undefined; this.snapshot={state:"failed",error:error instanceof Error?error.message:String(error)}; }
    return this.getSnapshot();
  }
  async stop():Promise<ProcessSnapshot> { if(this.handle) await this.handle.stop(); this.handle=undefined; this.snapshot={state:"stopped"}; return this.getSnapshot(); }
  async restart(command:string,args:string[]=[]):Promise<ProcessSnapshot> { await this.stop(); return this.start(command,args); }
}
