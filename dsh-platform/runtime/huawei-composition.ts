import { DshService } from "../dsh-core/dsh-service";
import { HuaweiDeviceLayer } from "../device-layer/huawei-device-layer";
import { HapBridgeTemplate,type HapNativeCallbacks } from "../device-layer/hap-bridge-template";
import { LocalRuntime } from "./local-runtime";
import { createHuaweiHarnessConfig,type HarnessConfig } from "./harness-config";
import { HarnessRuntime } from "./harness-runtime";
import { DshAppController } from "./dsh-app-controller";
import { HuaweiWorkspaceTransfer } from "./workspace-transfer";
import { DshWebViewSession,type WebViewTarget } from "../ui/webview-session";
export interface HuaweiDshComposition { controller:DshAppController; deviceLayer:HuaweiDeviceLayer; bridge:HapBridgeTemplate; config:HarnessConfig; }
export function createHuaweiDshComposition(native:HapNativeCallbacks,webView:WebViewTarget,configOverrides:Partial<HarnessConfig>={}):HuaweiDshComposition{
  const bridge=new HapBridgeTemplate(native); const deviceLayer=new HuaweiDeviceLayer(bridge); const runtime=new LocalRuntime(deviceLayer); const service=new DshService(runtime); const config=createHuaweiHarnessConfig(configOverrides); const harness=new HarnessRuntime(deviceLayer,config); const session=new DshWebViewSession(harness,webView); const transfer=new HuaweiWorkspaceTransfer(deviceLayer,bridge); const controller=new DshAppController(service,harness,session,transfer,config); return {controller,deviceLayer,bridge,config};
}
