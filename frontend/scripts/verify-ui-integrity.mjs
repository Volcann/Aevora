import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const hashes = JSON.parse(readFileSync(join(root, "docs/optimization/protected-source.json"), "utf8"));
const css = JSON.parse(readFileSync(join(root, "docs/optimization/append-only-css.json"), "utf8"));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const failures = [];
for (const [file, expected] of Object.entries(hashes)) {
  try { if (hash(readFileSync(join(root, file))) !== expected) failures.push(file); }
  catch { failures.push(file); }
}
for (const [file, expected] of Object.entries(css)) {
  try { if (hash(readFileSync(join(root, file)).subarray(0, expected.bytes)) !== expected.sha256) failures.push(file + " (original CSS changed)"); }
  catch { failures.push(file); }
}
if (failures.length) throw new Error("Protected source changed:\n" + failures.join("\n"));
console.log(`PASS: ${Object.keys(hashes).length} protected source files are byte-identical to the supplied archive.`);
console.log(`PASS: all original rules/keyframes/transitions in ${Object.keys(css).length} chat stylesheet(s) are unchanged.`);
