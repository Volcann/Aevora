/** Verify against the user's actual supplied ZIP, independently of older manifests. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
const frontend = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(join(frontend, "docs/playful-verification/upload-baseline.json"), "utf8"));
const root = resolve(frontend, manifest.verificationRootFromFrontend);
const hash = value => createHash("sha256").update(value).digest("hex");
for (const [file, expected] of Object.entries(manifest.unchangedFiles)) {
  assert.equal(hash(readFileSync(join(root, file))), expected, `Original source changed: ${file}`);
}
for (const [file, expected] of Object.entries(manifest.appendOnlyFiles)) {
  const bytes = readFileSync(join(root, file));
  assert(bytes.length >= expected.bytes, `Original CSS removed: ${file}`);
  assert.equal(hash(bytes.subarray(0, expected.bytes)), expected.sha256, `Original CSS changed: ${file}`);
}
const pkg = JSON.parse(readFileSync(join(root, manifest.packageFile), "utf8"));
const { scripts, ...fields } = pkg;
assert.deepEqual(fields, manifest.originalPackageFields, "Dependencies, package config or versions changed");
for (const [key, value] of Object.entries(manifest.originalPackageScripts)) assert.equal(scripts[key], value, `Existing script changed: ${key}`);
for (const key of Object.keys(scripts)) assert(key in manifest.originalPackageScripts || /^(test:playful(?::[a-z]+)?|verify:playful)$/.test(key), `Unexpected added script: ${key}`);
console.log(`PASS: ${Object.keys(manifest.unchangedFiles).length} original files byte-identical to ${manifest.sourceArchive}.`);
console.log("PASS: original chat stylesheet prefix, dependencies, lockfiles and existing package scripts preserved.");
console.log("PASS: original orb renderer, shaders, palettes, eyes, API/auth/session modules and native implementation unchanged.");
console.log("Intentional UI edits: " + manifest.modifiedUiFiles.join(", "));
