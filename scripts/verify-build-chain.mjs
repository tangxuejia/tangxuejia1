import fs from "node:fs";
import path from "node:path";
const root = path.resolve(process.argv[2] ?? "prototype/imported");
const required = [
  "app/src/main/cpp/dsh_bridge.cpp",
  "app/src/main/cpp/CMakeLists.txt",
  "app/src/main/java/com/tang/dshmobile/NodeBridge.java",
  "app/src/main/java/com/tang/dshmobile/RuntimeInstaller.java",
  "app/src/main/java/com/tang/dshmobile/WorkspaceZip.java",
  "scripts/package-runtime.sh",
  "scripts/verify-runtime.mjs",
  ".github/workflows/build-apk.yml",
];
for (const rel of required) if (!fs.existsSync(path.join(root, rel))) throw new Error("Build chain missing: " + rel);
const workflow = fs.readFileSync(path.join(root, ".github/workflows/build-apk.yml"), "utf8");
for (const marker of ["arm64-v8a", "libnode.so", "libdsh_bridge.so", "dsh-runtime.zip", "assembleDebug"]) if (!workflow.includes(marker)) throw new Error("Build chain missing workflow marker: " + marker);
const bridge = fs.readFileSync(path.join(root, "app/src/main/cpp/dsh_bridge.cpp"), "utf8");
if (!bridge.includes("node::Start")) throw new Error("Build chain missing node::Start JNI entry");
console.log("Build chain verification passed: " + required.length + " source/workflow checkpoints");
