import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(join(root, "docs/eyes-companion-review/source-integrity.json"), "utf8"));
const hash = value => createHash("sha256").update(value).digest("hex");
const read = file => readFileSync(join(root, file));
const failures = [];
for (const [file, expected] of Object.entries(manifest.unchangedOriginal)) {
  try { if (hash(read(file)) !== expected) failures.push(file + " (original source changed)"); }
  catch { failures.push(file + " (missing)"); }
}
for (const [file, expected] of Object.entries({...manifest.authorizedChanges,...manifest.newProductionFiles})) {
  try { if (hash(read(file)) !== expected.deliveredSha256) failures.push(file + " (reviewed change differs)"); }
  catch { failures.push(file + " (missing)"); }
}
for (const fragment of manifest.preservedFragments) {
  try {
    const text = read(fragment.file).toString("utf8");
    const start = text.indexOf(fragment.start);
    const end = text.indexOf(fragment.end, start + fragment.start.length);
    if (start < 0 || end < 0 || hash(text.slice(start,end).trim()) !== fragment.originalSha256) failures.push(fragment.label);
  } catch { failures.push(fragment.label); }
}
// Reverse exactly the Markdown selector addition, then verify every byte of the original stylesheet.
const css = manifest.desktopCss;
try {
  let text = read(css.file).toString("utf8");
  for (const {original, delivered} of css.replacements) {
    if (!text.includes(delivered)) throw new Error("Missing selector guard");
    text = text.replace(delivered, original);
  }
  if (!text.endsWith(css.appended)) throw new Error("Missing scope note");
  text = text.slice(0, -css.appended.length);
  if (hash(text) !== css.originalSha256) failures.push("Original floating-window CSS/animations");
} catch { failures.push("Original floating-window CSS/animations"); }
if (failures.length) throw new Error("Integrity failures:\n" + failures.join("\n"));
console.log(`PASS: ${Object.keys(manifest.unchangedOriginal).length} original files byte-identical (${manifest.project}).`);
console.log(`PASS: ${Object.keys(manifest.authorizedChanges).length} reviewed modifications and ${Object.keys(manifest.newProductionFiles).length} new production files match their delivery hashes.`);
console.log(`PASS: ${manifest.preservedFragments.length} original drag/fling/send/spark fragments and all original floating-window CSS declarations/keyframes/transitions preserved.`);
console.log("No API, IPC, dependency, shader, renderer, or object/tool transport implementation was changed.");
