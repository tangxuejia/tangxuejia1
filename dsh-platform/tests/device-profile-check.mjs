import fs from "node:fs";

const source = fs.readFileSync("../device-layer/device-profile.ts", "utf8");
for (const marker of ["phone", "tablet", "foldable", "desktop", "supportsLongRunningProcess"]) {
  if (!source.includes(marker)) throw new Error("Device profile missing: " + marker);
}
console.log("Huawei device profile check passed");
