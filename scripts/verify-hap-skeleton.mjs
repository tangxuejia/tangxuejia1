import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "dsh-platform/hap");
const required = [
  "AppScope/app.json5",
  "entry/src/main/module.json5",
  "entry/src/main/resources/base/profile/main_pages.json",
  "entry/src/main/ets/entryability/EntryAbility.ets",
  "entry/src/main/ets/pages/Index.ets",
  "entry/src/main/ets/bridge/HapNativeContract.ets"
];

for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) throw new Error("HAP skeleton missing: " + rel);
}
for (const rel of ["AppScope/app.json5", "entry/src/main/module.json5", "entry/src/main/resources/base/profile/main_pages.json"]) {
  JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}
const moduleConfig = fs.readFileSync(path.join(root, "entry/src/main/module.json5"), "utf8");
if (!moduleConfig.includes('"type": "entry"') || !moduleConfig.includes('"mainElement": "EntryAbility"')) {
  throw new Error("HAP module entry configuration is incomplete");
}
console.log("HAP skeleton verification passed: " + required.length + " checkpoints");
