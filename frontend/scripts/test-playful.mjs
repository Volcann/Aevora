import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const require = createRequire(import.meta.url);
const ts = require(process.env.AEVORA_TYPESCRIPT_PATH || "typescript");
const root = resolve(import.meta.dirname, "..");
const output = mkdtempSync(join(tmpdir(), "aevora-play-tests-"));
try {
  for (const [name, file] of [["playful-model", "components/orb/playful/playful-model.ts"], ["terminal-model", "components/chat/terminal/terminal-model.ts"]]) {
    const result = ts.transpileModule(readFileSync(join(root, "apps/web", file), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }, reportDiagnostics: true, fileName: file });
    if (result.diagnostics?.some(item => item.category === ts.DiagnosticCategory.Error)) throw new Error(`Syntax error in ${file}`);
    writeFileSync(join(output, `${name}.mjs`), result.outputText);
  }
  const result = spawnSync(process.execPath, ["--test", "tests/playful/models.test.mjs"], { cwd: root, env: { ...process.env, AEVORA_PLAY_TEST_BUILD: output }, stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally { rmSync(output, { recursive: true, force: true }); }
