import type { DeviceLayer, ProcessHandle } from "../dsh-core/contracts";
import { buildHarnessLaunchPlan, getHarnessUrl, type HarnessConfig } from "./harness-config";

export class HarnessRuntime {
  private process?: ProcessHandle;
  constructor(private readonly deviceLayer: DeviceLayer, private readonly config: HarnessConfig) {}
  async start(): Promise<{id:string;url:string}> {
    if (this.process && await this.process.isRunning()) return {id:this.process.id,url:this.url()};
    const plan=buildHarnessLaunchPlan(this.config);
    this.process=await this.deviceLayer.startProcess(plan.command,[...plan.args,"--cwd",plan.cwd]);
    return {id:this.process.id,url:this.url()};
  }
  async stop(): Promise<void> { if (!this.process) return; await this.process.stop(); this.process=undefined; }
  async restart(): Promise<{id:string;url:string}> { await this.stop(); return this.start(); }
  async isRunning(): Promise<boolean> { return this.process ? this.process.isRunning() : false; }
  url(): string { return getHarnessUrl(this.config); }
}
