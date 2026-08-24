import fs from "node:fs";

const controller = fs.readFileSync("../runtime/dsh-app-controller.ts", "utf8");
const harness = fs.readFileSync("../runtime/harness-runtime.ts", "utf8");
const webview = fs.readFileSync("../ui/webview-session.ts", "utf8");

for (const marker of ["async recover()", "this.harness.restart()", "this.webView.open()", "await this.service.stop()"]) {
  if (!controller.includes(marker)) throw new Error("Recovery controller missing: " + marker);
}
if (!harness.includes("async restart()")) throw new Error("Harness restart is missing");
if (!webview.includes("await this.webView.load(url)")) throw new Error("WebView reload path is missing");

console.log("DSH recovery check passed");
