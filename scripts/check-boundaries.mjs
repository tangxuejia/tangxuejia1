import fs from "node:fs";
import path from "node:path";
const rules = [
  { dir: "ui", forbidden: ["../device-layer", "device-layer/", "@ohos/", "@kit/"] },
  { dir: "dsh-core", forbidden: ["../ui", "../runtime", "../device-layer", "@ohos/", "@kit/"] },
  { dir: "runtime", forbidden: ["@ohos/", "@kit/"] },
];
function filesIn(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap((e) => {
    const c = path.join(dir, e.name);
    return e.isDirectory() ? filesIn(c) : /\\.(ts|tsx|js|jsx)$/.test(e.name) ? [c] : [];
  });
}
const violations = [];
for (const rule of rules) for (const file of filesIn(rule.dir)) {
  const source = fs.readFileSync(file, "utf8");
  for (const forbidden of rule.forbidden) if (source.includes(forbidden)) violations.push(file + ": forbidden dependency " + forbidden);
}
if (violations.length) { console.error(violations.join("\\n")); process.exit(1); }
console.log("Architecture boundary check passed");
