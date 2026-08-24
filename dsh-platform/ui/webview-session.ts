import type { HarnessRuntime } from "../runtime/harness-runtime";

export interface WebViewTarget { load(url:string):Promise<void>; clear():Promise<void>; }
export interface WebViewSessionOptions { reloadOnOpen?:boolean; }

export class DshWebViewSession {
  private loadedUrl?:string;
  constructor(private readonly harness:HarnessRuntime,private readonly webView:WebViewTarget,private readonly options:WebViewSessionOptions={}) {}
  async open():Promise<string> {
    const {url}=await this.harness.start();
    if(this.options.reloadOnOpen!==false || this.loadedUrl!==url) await this.webView.load(url);
    this.loadedUrl=url; return url;
  }
  async close():Promise<void> { try { await this.webView.clear(); } finally { await this.harness.stop(); this.loadedUrl=undefined; } }
  getUrl():string|undefined { return this.loadedUrl; }
}
