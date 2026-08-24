import fs from "node:fs";

const selection = fs.readFileSync("../runtime/node-runtime-selection.ts", "utf8");
const manifest = JSON.parse(fs.readFileSync("../hap/node-runtime-manifest.json", "utf8"));

for (const marker of ["android-arm64", "openharmony-arm64", "linked", "arm64"]) {
  if (!selection.includes(marker)) throw new Error("Node runtime selection missing: " + marker);
}
if (manifest.target !== "openharmony-arm64" || manifest.failClosed !== true) {
  throw new Error("HAP Node Runtime manifest must remain fail-closed");
}
console.log("Node Runtime target check passed");
