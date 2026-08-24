import type { DshSnapshot } from "../dsh-core/dsh-service";
import { DshService } from "../dsh-core/dsh-service";
import type { WorkspaceTransfer } from "./workspace-transfer";
import type { HarnessRuntime } from "./harness-runtime";
import { DshWebViewSession } from "../ui/webview-session";
import type { HarnessConfig } from "./harness-config";

export interface DshAppState { phase:"idle"|"importing"|"starting"|"recovering"|"ready"|"stopping"|"error"; url?:string; error?:string; }

export class DshAppController {
  private state:DshAppState={phase:"idle"};
  constructor(private readonly service:DshService,private readonly harness:HarnessRuntime,private readonly webView:DshWebViewSession,private readonly transfer:WorkspaceTransfer,private readonly harnessConfig?:HarnessConfig){}
  getState(){return {...this.state};}
  async open(workspaceArchive?:{sourcePath:string;workspacePath:string}):Promise<DshAppState>{let webViewOpened=false;try{if(workspaceArchive){this.state={phase:"importing"};await this.transfer.importArchive(workspaceArchive.sourcePath,workspaceArchive.workspacePath);}this.state={phase:"starting"};const snapshot=await this.service.start();this.assertReady(snapshot);const url=await this.webView.open();webViewOpened=true;this.state={phase:"ready",url};}catch(error){try{if(webViewOpened)await this.webView.close();else await this.harness.stop();await this.service.stop();}catch{}this.state={phase:"error",error:error instanceof Error?error.message:String(error)};}return this.getState();}
  async close():Promise<DshAppState>{this.state={phase:"stopping"};try{await this.webView.close();}finally{await this.service.stop();}this.state={phase:"idle"};return this.getState();}
  async recover():Promise<DshAppState>{this.state={phase:"recovering"};try{await this.harness.restart();const url=await this.webView.open();this.state={phase:"ready",url};}catch(error){this.state={phase:"error",error:error instanceof Error?error.message:String(error)};}return this.getState();}
  private assertReady(snapshot:DshSnapshot):asserts snapshot is DshSnapshot&{status:"ready"}{if(snapshot.status!=="ready")throw new Error(snapshot.error??"DSH runtime failed to start");}
}
