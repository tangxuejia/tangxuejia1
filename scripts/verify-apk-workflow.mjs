import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/dsh-apk-build.yml", "utf8");
const required = [
  "deepseek-harness-pura-x-mobile-v0.1.0-source.zip",
  "arm64",
  "arm64-v8a",
  "ndk;24.0.8215888",
  "nodejs-mobile",
  "dsh-runtime.zip",
  "assembleDebug",
  "app-debug.apk.sha256",
  "dsh-build-manifest.txt",
  "upload-artifact",
];
for (const marker of required) {
  if (!workflow.includes(marker)) throw new Error("APK workflow missing: " + marker);
}
if (workflow.includes("Pura X only")) throw new Error("Workflow must remain device-generic");
console.log("APK workflow verification passed: " + required.length + " markers");
