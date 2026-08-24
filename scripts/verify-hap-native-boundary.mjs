import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "dsh-platform/hap/entry/src/main");
const required = [
  "cpp/dsh_hap_bridge.h",
  "cpp/dsh_hap_bridge.cpp",
  "cpp/CMakeLists.txt",
  "ets/bridge/HapRuntimeSession.ets"
];
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) throw new Error("HAP native boundary missing: " + rel);
}
const cpp = fs.readFileSync(path.join(root, "cpp/dsh_hap_bridge.cpp"), "utf8");
if (!cpp.includes("fail closed") || !cpp.includes("Embedded Node runtime is not linked")) {
  throw new Error("HAP native bridge must fail closed before Node is linked");
}
console.log("HAP native boundary verification passed");
