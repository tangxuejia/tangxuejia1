import fs from "node:fs";
const required = [
  "dsh-core/contracts.ts",
  "dsh-core/dsh-service.ts",
  "device-layer/huawei-device-layer.ts",
  "device-layer/hap-bridge-template.ts",
  "runtime/harness-config.ts",
  "runtime/harness-runtime.ts",
  "runtime/runtime-installer.ts",
  "runtime/workspace-transfer.ts",
  "ui/webview-session.ts"
];
for (const file of required) if (!fs.existsSync(file)) throw new Error("Missing DSH layer: " + file);
const config = fs.readFileSync("runtime/harness-config.ts", "utf8");
if (!config.includes("arm64-v8a") || !config.includes("127.0.0.1") || !config.includes("3080")) throw new Error("Harness defaults are incomplete");
console.log("DSH smoke check passed: " + required.length + " layer files");
