/**
 * Export the desktop client without modifying the web app's auth proxy.
 * A native WebView serves static files and cannot execute Next server middleware.
 * The original proxy remains in apps/web and is used by normal web builds.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(root, "apps", "web");
const require = createRequire(join(app, "package.json"));
const stagingRoot = join(root, ".desktop-build");
const output = join(app, "out");
const stageOnly = process.argv.includes("--stage-only");
let next;
if (!stageOnly) {
  try { next = require.resolve("next/dist/bin/next"); }
  catch { throw new Error("Next.js is not installed. Run npm ci in frontend first."); }
}
mkdirSync(stagingRoot, { recursive: true });
const stage = mkdtempSync(join(stagingRoot, "export-"));
const stagedApp = join(stage, "apps", "web");
const skipDirectories = new Set(["node_modules", ".next", "out", ".git", "coverage", "test-results"]);
let child;
try {
  // Preserve the monorepo-relative Tailwind @source paths in the copied app.
  cpSync(join(root, "packages"), join(stage, "packages"), {
    recursive: true, filter: (source) => !skipDirectories.has(basename(source)),
  });
  cpSync(app, stagedApp, {
    recursive: true,
    filter(source) {
      if (skipDirectories.has(basename(source))) return false;
      const file = relative(app, source).replaceAll("\\", "/");
      // Only the server-only entrypoint is omitted, never its source or API auth.
      return !/^(?:src\/)?(?:proxy|middleware)\.[cm]?[jt]sx?$/.test(file)
        && !file.endsWith(".tsbuildinfo");
    },
  });
  if (!stageOnly) {
    // The UI workspace exports compiled CSS; build it before Next resolves it.
    const npmArgs = ["run", "build", "--workspace", "@repo/ui"];
    const npm = process.env.npm_execpath;
    const ui = spawnSync(npm ? process.execPath : (process.platform === "win32" ? "npm.cmd" : "npm"), npm ? [npm, ...npmArgs] : npmArgs, {
      cwd: root, stdio: "inherit", shell: !npm && process.platform === "win32",
    });
    if (ui.error) throw ui.error;
    if (ui.status !== 0) throw new Error("The shared UI workspace could not be built.");
  }
  if (stageOnly) {
    console.log(`Desktop staging verified at ${stagedApp}; no compiler was run.`);
  } else {
    child = spawnSync(process.execPath, [next, "build", stagedApp], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, AEVORA_DESKTOP_BUILD: "1" },
    });
    if (child.error) throw child.error;
    if (child.status !== 0) throw new Error(`Desktop export failed (exit ${child.status ?? child.signal}). Existing out/ was preserved.`);
    const exported = join(stagedApp, "out");
    for (const route of ["index.html", "pet/index.html"]) {
      if (!existsSync(join(exported, route))) throw new Error(`Missing desktop route: ${route}`);
    }
    // Replace assets only after a successful build; rollback a failed file move.
    const backup = join(stage, "previous-out");
    if (existsSync(output)) renameSync(output, backup);
    try { renameSync(exported, output); }
    catch (error) { if (existsSync(backup)) renameSync(backup, output); throw error; }
    console.log(`Desktop assets ready: ${output}`);
  }
} finally {
  if (!stageOnly) rmSync(stage, { recursive: true, force: true });
}
