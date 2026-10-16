import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
const require = createRequire(import.meta.url);
const ts = require(process.env.AEVORA_TYPESCRIPT_PATH || "typescript");
const root = resolve(import.meta.dirname, "..");
const output = mkdtempSync(join(tmpdir(), "aevora-markdown-tests-"));
try {
  const source = "apps/web/lib/inline-markdown.ts";
  const result = ts.transpileModule(readFileSync(join(root, source), "utf8"), {
    fileName: source, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, strict: true },
  });
  const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) throw new Error(errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("\n"));
  const module = join(output, "inline-markdown.mjs");
  writeFileSync(module, result.outputText);
  const tests = spawnSync(process.execPath, ["--test", "tests/companion/inline-markdown.test.mjs"], {
    cwd: root, stdio: "inherit", env: { ...process.env, AEVORA_MD_MODULE: module },
  });
  process.exitCode = tests.status ?? 1;
} finally { rmSync(output, { recursive: true, force: true }); }
