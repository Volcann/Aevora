import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
const require = createRequire(import.meta.url);
const ts = require(process.env.AEVORA_TYPESCRIPT_PATH || process.env.ORB_TYPESCRIPT_PATH || "typescript");
const root = resolve(import.meta.dirname, "..");
const output = mkdtempSync(join(tmpdir(), "aevora-optimization-"));
try {
  const file = "apps/web/lib/streaming-text.ts";
  const result = ts.transpileModule(readFileSync(join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, strict: true },
    fileName: file, reportDiagnostics: true,
  });
  const errors = (result.diagnostics || []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  if (errors.length) throw new Error(errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n"));
  const module = join(output, "streaming-text.mjs"); writeFileSync(module, result.outputText);
  const tests = spawnSync(process.execPath, ["--test", "tests/optimization/streaming-text.test.mjs"], {
    cwd: root, stdio: "inherit", env: { ...process.env, AEVORA_STREAM_TEST_MODULE: module },
  });
  process.exitCode = tests.status ?? 1;
} finally { rmSync(output, { recursive: true, force: true }); }
