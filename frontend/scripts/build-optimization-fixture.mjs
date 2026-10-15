/** Real application UI + explicit API/native test doubles. Never part of production. */
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
const toolRoot = resolve(import.meta.dirname, '..');
const root = resolve(process.env.AEVORA_TEST_SOURCE_ROOT || toolRoot);
const require = createRequire(join(toolRoot, 'package.json'));
const ts = require(process.env.AEVORA_TYPESCRIPT_PATH || 'typescript');
const tailwind = require(process.env.AEVORA_TAILWIND_PATH ? join(process.env.AEVORA_TAILWIND_PATH, 'dist/lib.js') : 'tailwindcss');
const output = resolve(process.env.AEVORA_TEST_BUILD_DIR || join(toolRoot, '.ui-test-build'));
mkdirSync(output, { recursive: true });
for (const entry of readdirSync(join(root, 'apps/web/public'), { withFileTypes: true })) if (entry.isFile()) copyFileSync(join(root, 'apps/web/public', entry.name), join(output, entry.name));
const modules = {}, cssModules = {}, styles = [], sources = [], diagnostics = [];
function compile(source, file) {
  const result = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: file, reportDiagnostics: true,
  });
  diagnostics.push(...(result.diagnostics || []).filter(x => x.category === ts.DiagnosticCategory.Error).map(x => `${file}: ${ts.flattenDiagnosticMessageText(x.messageText, '\n')}`));
  return result.outputText;
}
function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules','.next','out','dist'].includes(entry.name)) continue;
    const file = join(directory, entry.name), id = relative(root, file).replaceAll('\\','/');
    if (entry.isDirectory()) collect(file);
    else if (/\.tsx?$/.test(file) && !file.endsWith('.d.ts')) {
      const source=readFileSync(file,'utf8');sources.push(source);modules[id.replace(/\.tsx?$/,'')]=compile(source,file);
    } else if (/\.module\.css$/.test(file)) {
      const css=readFileSync(file,'utf8'), prefix=entry.name.replace('.module.css','');
      const names=Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(m=>[m[1],`${prefix}_${m[1]}`]));
      cssModules[id]=names;
      styles.push(css.replace(/\.([a-zA-Z_][\w-]*)/g,(_,name)=>`.${names[name]}`));
    }
  }
}
collect(join(root,'apps/web'));collect(join(root,'packages/ui/src'));
if(diagnostics.length)throw new Error(diagnostics.join('\n'));
const vendor=process.env.AEVORA_TEST_VENDOR_DIR;
if(vendor){
  for(const [id,file] of [['react','react.cjs'],['react-dom','react-dom-core.cjs'],['scheduler','scheduler.cjs'],['react/jsx-runtime','jsx-runtime.cjs'],['lucide-react','lucide.cjs']])modules[id]=readFileSync(join(vendor,file),'utf8');
  modules['react-dom/client']="module.exports=require('react-dom');";
}else{
  const packageDir=name=>dirname(require.resolve(`${name}/package.json`));
  for(const [id,pkg,file] of [['react','react','react.production.js'],['react-dom','react-dom','react-dom.production.js'],['react-dom/client','react-dom','react-dom-client.production.js'],['scheduler','scheduler','scheduler.production.js'],['react/jsx-runtime','react','react-jsx-runtime.production.js']])modules[id]=readFileSync(join(packageDir(pkg),'cjs',file),'utf8');
  modules['lucide-react']=readFileSync(require.resolve('lucide-react'),'utf8');
}
// The loader substitutes Next's chunk transport, not the component itself.
modules['next/dynamic']=`const React=require('react');module.exports=(load)=>{const Lazy=React.lazy(()=>{window.fixture.dynamicLoads++;return load().then(value=>({default:value.default||value}));});return function Dynamic(props){return React.createElement(React.Suspense,{fallback:null},React.createElement(Lazy,props));};};`;
modules['apps/web/lib/api']=`exports.api=window.fixture.api;exports.getSavedTokens=()=>window.fixture.auth?{access:'fixture-token'}:null;exports.getApiBaseUrl=()=>window.fixture.apiUrl;exports.setApiBaseUrl=value=>window.fixture.apiUrl=value;exports.quitApp=()=>window.fixture.nativeCalls.push({command:'quit_app'});exports.clearTokens=()=>window.fixture.auth=false;`;
for(const [id,name,counter] of [
  ['apps/web/components/chat/ChatInput','ChatInput','input'],['apps/web/components/chat/ChatSidebar','ChatSidebar','sidebar'],['apps/web/components/nav/TopNavSwitcher','TopNavSwitcher','nav'],['apps/web/components/chat/ChatHistory','ChatHistory','history'],['apps/web/components/settings/SettingsModal','SettingsModal','settings'],
])if(modules[id])modules[id]=modules[id].replace(new RegExp(`(function ${name}\\([\\s\\S]*?\\)\\s*\\{)`),`$1\nwindow.fixture.renders.${counter}++;`);
const md='apps/web/components/chat/MarkdownRenderer';
modules[md]=modules[md].replace(/(function MarkdownRenderer\([\s\S]*?\)\s*\{)/,`$1\nwindow.fixture.renders.markdown++;if(content.startsWith('Saved answer'))window.fixture.renders.savedMarkdown++;`);
const settings='apps/web/components/settings/SettingsModal';modules[settings]='window.fixture.settingsModuleLoads++;\n'+modules[settings];
const orb='apps/web/components/orb/OrbVisual';modules[orb]=modules[orb].replace('const safeTheme =','window.fixture.orbRenders++; const safeTheme =');

// A deterministic URL seam keeps these UI tests completely network-free.
modules['apps/web/app/page'] = modules['apps/web/app/page'].replaceAll('window.location.search', '(window.__fixtureQuery || window.location.search)');
for (const [id, source] of Object.entries(modules)) {
  try { new Function('module', 'exports', 'require', source); }
  catch (error) { throw new Error(`Invalid browser fixture module ${id}: ${error.message}`); }
}

// Compile the real global styles and every static utility candidate. The local
// compatibility override is reported, not substituted into package/lockfiles.
const strip=css=>css.replace(/^@(import|source)[^;]+;\s*/gm,'');
const global=strip(readFileSync(join(root,'apps/web/app/globals.css'),'utf8'));
const shared=strip(readFileSync(join(root,'packages/tailwind-config/shared-styles.css'),'utf8'));
const tailwindDir=process.env.AEVORA_TAILWIND_PATH || dirname(require.resolve('tailwindcss/package.json'));
const compiler=await tailwind.compile(`@import "tailwindcss";\n${shared}\n${global}`,{
  base:root,
  loadStylesheet:async(id,base)=>{
    const path=id==='tailwindcss'?join(tailwindDir,'index.css'):resolve(base,id);
    return {path,base:dirname(path),content:readFileSync(path,'utf8')};
  },
});
const candidates=[...new Set(sources.flatMap(source=>source.match(/[^\s"'`<>]+/g)||[]))];
const generated=compiler.build(candidates);
const suppliedUiCss=readFileSync(join(root,'packages/ui/dist/index.css'),'utf8');
writeFileSync(join(output,'styles.css'),suppliedUiCss+'\n'+generated+'\n'+styles.join('\n')+'\n#root{height:100dvh;}');
const loader=`window.process={env:{NODE_ENV:'production'}};const modules=${JSON.stringify(modules)},cssModules=${JSON.stringify(cssModules)},cache={};function require(id,from=''){if(id.startsWith('.')){const p=from.split('/');p.pop();for(const part of id.split('/')){if(part==='..')p.pop();else if(part!=='.')p.push(part)}id=p.join('/')}if(id.endsWith('.css'))return cssModules[id]||{};if(cache[id])return cache[id].exports;if(!modules[id])throw new Error('Missing fixture module: '+id);const module={exports:{}};cache[id]=module;new Function('module','exports','require',modules[id])(module,module.exports,(next)=>require(next,id));return module.exports}window.fixtureRequire=require;`;
writeFileSync(join(output,'bundle.js'),loader+'\n'+readFileSync(join(toolRoot,'tests/optimization/browser-fixture.cjs'),'utf8'));
writeFileSync(join(output,'index.html'),'<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="styles.css"><title>Aevora UI verification fixture</title></head><body><div id="root"></div><script src="bundle.js"></script></body></html>');
writeFileSync(join(output,'build-metadata.json'),JSON.stringify({sourceRoot:root,modules:Object.keys(modules).length,typescript:ts.version,compatibilityRuntime:!!vendor,...(vendor&&existsSync(join(vendor,'metadata.json'))?JSON.parse(readFileSync(join(vendor,'metadata.json'),'utf8')):{})},null,2));
console.log(`PASS: ${Object.keys(modules).length} real-source modules transpiled; browser fixture: ${output}`);
