/** Isolated browser fixture. Real UI modules; speech, API and native IPC are test doubles. */
import { createRequire } from "node:module";
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
const require = createRequire(import.meta.url);
const ts = require(process.env.ORB_TYPESCRIPT_PATH || "typescript");
const root = resolve(import.meta.dirname, "..");
const output = resolve(process.env.ORB_BROWSER_OUTPUT || join(root, ".orb-test-build"));
mkdirSync(output, { recursive: true });
const modules = {}, cssModules = {}, stylesheets = [];
function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { collect(path); continue; }
    const id = relative(root, path).replaceAll("\\", "/");
    if (/\.tsx?$/.test(path)) modules[id.replace(/\.tsx?$/, "")] = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: path,
    }).outputText;
    else if (/\.module\.css$/.test(path)) {
      // Preserve CSS-module scoping. Raw class names collide between chat and call UIs.
      const css = readFileSync(path, "utf8");
      const prefix = entry.name.replace(/\.module\.css$/, "");
      const names = Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => [m[1], `${prefix}_${m[1]}`]));
      cssModules[id] = names;
      stylesheets.push(css.replace(/\.([a-zA-Z_][\w-]*)/g, (_, name) => `.${names[name]}`));
    }
  }
}
collect(join(root, "apps/web/components"));
collect(join(root, "apps/web/lib"));
for (const file of ["apps/web/app/page.tsx", "apps/web/app/pet/page.tsx"]) {
  modules[file.replace(/\.tsx$/, "")] = ts.transpileModule(readFileSync(join(root,file),"utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop:true }, fileName:file }).outputText;
}
// Default uses the installed project version. Offline compatibility overrides
// are explicitly reported by the tests and do not change dependencies/lockfiles.
if (process.env.ORB_REACT_VENDOR_DIR) {
  for (const [name, file] of [["react", "react.cjs"], ["scheduler", "scheduler.cjs"], ["react-dom/client", "react-dom.cjs"]]) modules[name] = readFileSync(join(process.env.ORB_REACT_VENDOR_DIR, file), "utf8");
} else {
  const packageDir = (name) => dirname(require.resolve(`${name}/package.json`));
  const react = packageDir("react"), dom = packageDir("react-dom"), scheduler = packageDir("scheduler");
  modules.react = readFileSync(join(react, "cjs/react.production.js"), "utf8");
  modules["react-dom"] = readFileSync(join(dom, "cjs/react-dom.production.js"), "utf8");
  modules["react-dom/client"] = readFileSync(join(dom, "cjs/react-dom-client.production.js"), "utf8");
  modules.scheduler = readFileSync(join(scheduler, "cjs/scheduler.production.js"), "utf8");
}
modules["react/jsx-runtime"] = `const React=require('react');exports.Fragment=React.Fragment;exports.jsx=exports.jsxs=(type,props,key)=>React.createElement(type,{...props,...(key===undefined?{}:{key})});`;
modules["lucide-react"] = readFileSync(join(root,"tests/orb/icon-fixture.cjs"),"utf8");
modules["apps/web/lib/api"] = `exports.getSavedTokens=()=>window.fixture.auth?{access:'fixture-token'}:null;exports.quitApp=()=>{};exports.api={health:async()=>({status:'online'}),getMe:async()=>({username:'Alex',email:'alex@example.test'}),getTools:async()=>[],getSessions:async()=>window.fixture.sessions,getSession:async(id)=>({messages:window.fixture.savedMessages[id]||[]}),logout:async()=>{},deleteSession:async()=>{},streamChat:async(id,prompt,callbacks,signal)=>{const f=window.fixture;f.prompts.push(prompt);f.requests.push({id,prompt,callbacks,signal});f.stream=callbacks;return new Promise(resolve=>{f.resolveRequest=resolve;if(signal)signal.addEventListener('abort',()=>{f.aborts++;resolve();},{once:true});});}};`;
// These unchanged screens are outside the scope of this UI regression fixture.
modules["apps/web/components/auth/AuthViews"] = `exports.AuthViews=()=>require('react').createElement('p',null,'Sign in fixture');`;
modules["apps/web/components/settings/SettingsModal"] = `exports.SettingsModal=()=>null;`;
modules["apps/web/components/orb/OrbVisual"] = modules["apps/web/components/orb/OrbVisual"].replace("const safeTheme =", "window.fixture.visualRenders++; const safeTheme =");
const loader = `const modules=${JSON.stringify(modules)};const cssModules=${JSON.stringify(cssModules)};const cache={};function require(id,from=''){if(id.startsWith('.')){const p=from.split('/');p.pop();for(const part of id.split('/')){if(part==='..')p.pop();else if(part!=='.')p.push(part);}id=p.join('/');}if(id.endsWith('.css'))return cssModules[id]||{};if(cache[id])return cache[id].exports;if(!modules[id])throw new Error('Missing fixture module: '+id);const module={exports:{}};cache[id]=module;new Function('module','exports','require',modules[id])(module,module.exports,(next)=>require(next,id));return module.exports;}window.orbRequire=require;`;
writeFileSync(join(output,"bundle.js"),loader+"\n"+readFileSync(join(root,"tests/orb/browser-fixture.js"),"utf8"));
writeFileSync(join(output,"orb.css"),stylesheets.join("\n"));
writeFileSync(join(output,"index.html"),`<!doctype html><html data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aevora UI regression fixture</title><link rel="stylesheet" href="orb.css"><style>*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,sans-serif}button,input,select,textarea{font:inherit}button{line-height:normal}p{margin:0 0 12px}h1,h2,h3{margin:0}a{color:inherit}#root{min-height:100dvh}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}:root{--bg:#111215;--surface:rgba(27,28,34,.88);--surface-solid:#191a20;--surface-hover:#24252e;--border:#2c2d36;--text:#f0f0f4;--text-muted:#999aa9;--input-bg:#1a1b22;--msg-user-bg:#353047;--msg-ai-bg:transparent}html.pet-desktop-window,body.pet-desktop-window{background:transparent!important;overflow:hidden;min-height:0!important}.fixtureVisual{min-height:100dvh;display:grid;place-items:center}pre{overflow:auto;max-width:100%;padding:16px;background:#171821;border-radius:10px}code{font-family:monospace}table{border-collapse:collapse}td,th{padding:8px;border:1px solid var(--border)}</style></head><body><div id="root"></div><script src="bundle.js"></script></body></html>`);
console.log(`Browser fixture: ${output}`);
