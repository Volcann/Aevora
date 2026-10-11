import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
let ts;
try { ts = require(process.env.ORB_TYPESCRIPT_PATH || "typescript"); }
catch { throw new Error("TypeScript is required. Run npm ci in frontend first."); }
const root = resolve(import.meta.dirname, "..");
const output = mkdtempSync(join(tmpdir(), "aevora-orb-tests-"));
const files = [
  "apps/web/lib/speech.ts", "apps/web/lib/orbTheme.ts",
  "apps/web/components/orb/core/orb-model.ts", "apps/web/components/orb/core/orb-shaders.ts",
  "apps/web/components/orb/core/orb-renderer.ts", "apps/web/components/orb/core/voice-session.ts",
];
try {
  for (const file of files) {
    const result = ts.transpileModule(readFileSync(join(root, file), "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, strict: true },
      fileName: file, reportDiagnostics: true,
    });
    const errors = result.diagnostics?.filter((item) => item.category === ts.DiagnosticCategory.Error) ?? [];
    if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, { getCanonicalFileName: (x) => x, getCurrentDirectory: () => root, getNewLine: () => "\n" }));
    const destination = join(output, file.replace(/\.ts$/, ".mjs"));
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, result.outputText.replace(/(from\s+["'])(\.[^"']+)(["'])/g, "$1$2.mjs$3"));
  }
  const result = spawnSync(process.execPath, ["--test", "tests/orb/core.test.mjs"], {
    cwd: root, stdio: "inherit", env: { ...process.env, ORB_TEST_BUILD_DIR: output },
  });
  process.exitCode = result.status ?? 1;
} finally { rmSync(output, { recursive: true, force: true }); }
