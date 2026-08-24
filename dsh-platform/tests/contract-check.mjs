import fs from "node:fs";

const checks = [
  ["dsh-core/contracts.ts", ["interface DeviceLayer", "interface DshRuntime"]],
  ["runtime/harness-config.ts", ["arm64-v8a", "127.0.0.1", "3080"]],
  ["runtime/harness-runtime.ts", ["buildHarnessLaunchPlan", "restart"]],
  ["runtime/runtime-installer.ts", ["readVersionStamp", "replaceDirectory"]],
  ["runtime/workspace-transfer.ts", ["assertSafeArchivePath", "ArchiveBridge"]],
  ["ui/webview-session.ts", ["reloadOnOpen", "getUrl"]],
];

for (const [file, markers] of checks) {
  const source = fs.readFileSync("../" + file, "utf8");
  for (const marker of markers) {
    if (!source.includes(marker)) throw new Error(file + " missing contract marker: " + marker);
  }
}
console.log("DSH contract smoke test passed: " + checks.length + " modules");
