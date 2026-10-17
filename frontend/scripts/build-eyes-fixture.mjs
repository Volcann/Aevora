/** Isolated real-source eye fixture. Never imported into the application. */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
const require = createRequire(import.meta.url);
const ts = require(process.env.AEVORA_TYPESCRIPT_PATH || "typescript");
const root = resolve(import.meta.dirname, "..");
const output = resolve(process.env.AEVORA_EYE_BUILD || join(root, ".eye-test-build"));
const vendor = process.env.AEVORA_TEST_VENDOR_DIR;
const modules = {}, cssModules = {}, styles = [];
const files = [
  "apps/web/components/orb/OrbEyes.tsx", "apps/web/components/orb/OrbVisual.tsx",
  "apps/web/components/orb/hooks/useOrbEyes.ts", "apps/web/components/orb/core/eye-behavior.ts",
  "apps/web/components/orb/core/orb-model.ts", "apps/web/components/orb/core/orb-shaders.ts",
  "apps/web/components/orb/core/orb-renderer.ts", "apps/web/lib/orbTheme.ts", "apps/web/hooks/useDialogFocus.ts",
];
files.push("apps/web/lib/desktop-runtime.ts");
if (existsSync(join(root, "apps/web/lib/orbMotion.ts"))) files.push("apps/web/lib/orbMotion.ts");
for (const file of files) {
  const result = ts.transpileModule(readFileSync(join(root,file),"utf8"), {
    fileName: file, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  if (result.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error)) throw new Error(`Syntax error: ${file}`);
  let source = result.outputText;
  if (file.endsWith("useOrbEyes.ts")) source = source.replace("const containerRef =", "window.eyeFixture.metrics.renders++; const containerRef =");
  modules[file.replace(/\.tsx?$/, "")] = source;
}
for (const file of ["apps/web/components/orb/OrbEyes.module.css", "apps/web/components/orb/Orb.module.css"]) {
  const css = readFileSync(join(root,file),"utf8"), prefix = file.split("/").at(-1).replace(".module.css", "");
  const names = Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(m=>[m[1],`${prefix}_${m[1]}`]));
  cssModules[file] = names;
  styles.push(css.replace(/\.([a-zA-Z_][\w-]*)/g, (_,name)=>`.${names[name]}`));
}
if (vendor) {
  for (const [id,file] of [["react","react.cjs"],["react-dom/client","react-dom.cjs"],["scheduler","scheduler.cjs"],["react/jsx-runtime","jsx-runtime.cjs"]]) modules[id]=readFileSync(join(vendor,file),"utf8");
} else {
  for (const [id,pkg,file] of [["react","react","react.production.js"],["react-dom","react-dom","react-dom.production.js"],["react-dom/client","react-dom","react-dom-client.production.js"],["scheduler","scheduler","scheduler.production.js"],["react/jsx-runtime","react","react-jsx-runtime.production.js"]]) modules[id]=readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)),"cjs",file),"utf8");
}
const loader=`window.process={env:{NODE_ENV:'production'}};const modules=${JSON.stringify(modules)},cssModules=${JSON.stringify(cssModules)},cache={};function require(id,from=''){if(id.startsWith('.')){const p=from.split('/');p.pop();for(const part of id.split('/')){if(part==='..')p.pop();else if(part!=='.')p.push(part)}id=p.join('/')}if(id.endsWith('.css'))return cssModules[id]||{};if(cache[id])return cache[id].exports;if(!modules[id])throw new Error('Missing fixture module: '+id);const module={exports:{}};cache[id]=module;new Function('module','exports','require',modules[id])(module,module.exports,next=>require(next,id));return module.exports}`;
mkdirSync(output,{recursive:true});
writeFileSync(join(output,"bundle.js"), loader+"\n"+readFileSync(join(root,"tests/eyes/browser-fixture.cjs"),"utf8"));
writeFileSync(join(output,"styles.css"),styles.join("\n"));
writeFileSync(join(output,"index.html"),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="styles.css"><title>Aevora eye regression fixture</title><style>body{margin:0;background:#111215;color:#f0f0f4;font-family:system-ui}main{display:flex;gap:48px;flex-wrap:wrap;padding:48px}.eye-test-host{position:relative;width:220px;height:220px;--orb-accent:#6bdcff}.eye-test-host>button{position:absolute;inset:0;background:transparent;border:0;color:transparent}.caption{text-align:center;font-size:13px;color:#a2a2b4}.dialog{position:fixed;left:32px;top:360px;padding:20px;background:#252632;border:1px solid #4c4d5a;border-radius:12px}input{color:#eee;background:#15161c;border:1px solid #67677a;padding:10px}</style></head><body><div id="root"></div><script src="bundle.js"></script></body></html>`);
writeFileSync(join(output,"metadata.json"),JSON.stringify({compatibilityRuntime:!!vendor,typescript:ts.version},null,2));
console.log(`Eye fixture built: ${output}`);
