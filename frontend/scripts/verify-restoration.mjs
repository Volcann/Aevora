// Source-integrity check only. Does not modify the application or use any APIs.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(readFileSync(join(root, "docs/orb-restoration/source-lock.json"), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const [file, expected] of Object.entries(lock.protected_files)) {
  assert.equal(hash(readFileSync(join(root, file))), expected, `Original file changed: ${file}`);
}
for (const [file, entry] of Object.entries(lock.retained_changes)) {
  assert.equal(hash(readFileSync(join(root, file))), entry.delivered_sha256, `Retained change differs: ${file}`);
}
const css = readFileSync(join(root, lock.chat_css.file));
assert.equal(hash(css.subarray(0, lock.chat_css.original_bytes)), lock.chat_css.original_sha256,
  "Original chat CSS was changed instead of appended to");
function filesAt(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? filesAt(path) : [relative(root, path).split("\\").join("/")];
  });
}
assert.deepEqual(filesAt(join(root, lock.orb_directory)).sort(), lock.orb_files,
  "Orb file inventory differs from the original upload");
console.log(`PASS: all ${lock.orb_files.length} original orb files restored byte-for-byte; no added orb files.`);
console.log(`PASS: ${Object.keys(lock.protected_files).length} original files are byte-identical.`);
console.log("PASS: only the recorded app-level changes and verification metadata differ; original chat CSS preserved.");
