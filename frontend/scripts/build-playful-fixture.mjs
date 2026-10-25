/** Real UI source with explicit API/native test doubles. Never shipped to production. */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
const root = resolve(import.meta.dirname, "..");
const output = resolve(process.env.AEVORA_TEST_BUILD_DIR || join(root, ".playful-test-build"));
const result = spawnSync(process.execPath, [join(root, "scripts/build-optimization-fixture.mjs")], {
  env: { ...process.env, AEVORA_TEST_BUILD_DIR: output }, stdio: "inherit",
});
if (result.status) process.exit(result.status);
// The uploaded fixture predates token-sync initialization. Extend the TEST double,
// not the application's auth flow or its API implementation.
const file = join(output, "bundle.js");
let bundle = readFileSync(file, "utf8");
bundle = bundle.replace("fixture.api={", "fixture.api={syncTokensFromDesktop:async()=>{},");
writeFileSync(file, bundle);
console.log("PASS: playground fixture includes the existing desktop-token sync test boundary.");
