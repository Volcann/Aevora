// The UI is real source. Network, speech hardware and native IPC are test doubles.
const React = require('react'), ReactDOM = require('react-dom/client');
const options = window.__uiOptions || {}, query = new URLSearchParams(window.__fixtureQuery || location.search);
const fixture = window.fixture = {
  reactVersion: React.version, auth: options.auth !== false, dynamicLoads: 0, settingsModuleLoads: 0,
  renders: { input:0, sidebar:0, nav:0, history:0, settings:0, markdown:0, savedMarkdown:0 },
  orbRenders:0, glDraws:0, glCreated:0, glDeleted:0, requests:[], calls:[], nativeCalls:[], listeners:{},
  mediaCalls:0, aborts:0, petVisible:false, renderActive:true, apiUrl:'http://127.0.0.1:8002',
  sessions: options.sessions || [], savedMessages: options.messages || {},
  models: options.models || [{ name:'gemini-3.5-flash-lite', quota:'8.00' }, { name:'a-very-long-model-name-for-responsive-layout-verification', quota:'4.25' }],
  tools: options.tools || [{name:'search_workspace_with_a_deliberately_long_tool_identifier',description:'Search notes, files, and connected workspace content.'}],
  delayedSessions:{}, sessionResolvers:{}, deleteFails:false, utterances:[], recognitions:[],
};
localStorage.setItem('aevora-pet-enabled', options.pet ? 'true' : 'false');
if(options.selectedModel)localStorage.setItem('aevora-selected-model',options.selectedModel);
if(options.motion)localStorage.setItem('aevora-orb-motion',options.motion);
const gl=window.WebGLRenderingContext?.prototype;
if(gl)for(const [method,counter] of [['drawArrays','glDraws'],['createProgram','glCreated'],['deleteProgram','glDeleted']]){
  const original=gl[method];gl[method]=function(...args){fixture[counter]++;return original.apply(this,args);};
}
if(options.noWebGL){const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.includes('webgl')?null:get.call(this,type,...args);};}
function native(command,args){
  fixture.nativeCalls.push({command,args});
  if(command==='is_pet_window_open')return Promise.resolve(fixture.petVisible);
  if(command==='open_pet_window'||command==='close_pet_window'){
    fixture.petVisible=command==='open_pet_window';fixture.listeners.visibility?.forEach(fn=>fn(fixture.petVisible));return Promise.resolve(true);
  }
  if(command==='pet_ready'){fixture.petVisible=true;return Promise.resolve(true);}
  return Promise.resolve();
}
function listen(name,fn){(fixture.listeners[name]||=[]).push(fn);return()=>fixture.listeners[name]=fixture.listeners[name].filter(item=>item!==fn);}
window.aevoraDesktop={platform:'linux',openPet:p=>native('open_pet_window',p),closePet:()=>native('close_pet_window'),isPetOpen:()=>native('is_pet_window_open'),resizePet:(width,height)=>native('resize_pet_window',{width,height}),positionPet:(x,y)=>native('set_pet_window_position',{x,y}),nudgePet:(dx,dy)=>native('nudge_pet_window',{dx,dy}),pinPet:pinned=>native('set_pet_pinned',{pinned}),focusMain:()=>native('focus_main_window'),petReady:()=>native('pet_ready'),quit:()=>native('quit_app'),getRenderState:()=>Promise.resolve(fixture.renderActive),onPetVisibility:fn=>listen('visibility',fn),onRenderState:fn=>listen('render',fn),onResume:fn=>listen('resume',fn)};
fixture.setNativeActive=active=>{fixture.renderActive=active;fixture.listeners.render?.forEach(fn=>fn(active));};
class Recognition{constructor(){fixture.recognitions.push(this);}start(){this.onstart?.();}stop(){this.onend?.();}abort(){this.onend?.();}}
window.SpeechRecognition=Recognition;window.webkitSpeechRecognition=Recognition;
window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
Object.defineProperty(window,'speechSynthesis',{configurable:true,value:Object.assign(new EventTarget(),{getVoices:()=>[{name:'Test English',lang:'en-US',default:true}],cancel(){},resume(){},speak(value){fixture.utterances.push(value);}})});
Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{fixture.mediaCalls++;return {getTracks:()=>[{stop(){}}]};}}});
window.AudioContext=undefined;window.webkitAudioContext=undefined;
function call(name){fixture.calls.push({name,at:performance.now()});}
fixture.api={
  health:async()=>{call('health');if(options.delayHealth)return new Promise(resolve=>{fixture.resolveHealth=resolve;});return {status:'online'};},
  getMe:async()=>{call('profile');if(options.delayProfile)return new Promise(resolve=>{fixture.resolveProfile=resolve;});return {id:'fixture-user',username:options.username||'Alex',email:'alex@example.test'};},
  getSessions:async()=>{call('sessions');if(fixture.delaySessionList)return new Promise(resolve=>{fixture.resolveSessionList=resolve;});return structuredClone(fixture.sessions);},
  getSession:async id=>{call(`session:${id}`);if(fixture.delayedSessions[id])return new Promise(resolve=>{fixture.sessionResolvers[id]=resolve;});return {messages:structuredClone(fixture.savedMessages[id]||[])};},
  getTools:async()=>{call('tools');return structuredClone(fixture.tools);},
  getModels:async()=>{call('models');return structuredClone(fixture.models);},
  deleteSession:async id=>{call(`delete:${id}`);if(fixture.deleteFails)throw new Error('Deletion failed');if(fixture.delayDelete)await new Promise(resolve=>fixture.resolveDelete=resolve);fixture.sessions=fixture.sessions.filter(session=>session.id!==id);},
  logout:async()=>{call('logout');fixture.auth=false;},
  login:async()=>({user:{id:'fixture-user',username:'Alex',email:'alex@example.test'}}),
  changePassword:async()=>({message:'Password changed.'}),
  streamChat:async(id,prompt,callbacks,signal,requestOptions)=>new Promise(resolve=>{
    const request={id,prompt,callbacks,signal,options:requestOptions,resolve};fixture.requests.push(request);fixture.stream=callbacks;
    signal?.addEventListener('abort',()=>{fixture.aborts++;resolve();},{once:true});
  }),
};
fixture.finish=(text='A complete reply.',index=fixture.requests.length-1)=>{const r=fixture.requests[index];r.callbacks.onChunk(text);r.callbacks.onDone?.();r.resolve();};
fixture.resolveSession=(id,messages)=>fixture.sessionResolvers[id]?.({messages});
const Home=require('apps/web/app/page').default;
const root=fixture.root=ReactDOM.createRoot(document.getElementById('root'));
fixture.unmount=()=>root.unmount();
fixture.renderOrb=(size=165,theme=1)=>{const {OrbVisual}=require('apps/web/components/orb/OrbVisual');root.render(React.createElement('div',{style:{padding:24}},React.createElement(OrbVisual,{size,theme})));};
if(query.get('view')==='orb')fixture.renderOrb(Number(query.get('size')||165));
else if(query.get('view')==='pet')root.render(React.createElement(require('apps/web/app/pet/page').default));
else root.render(React.createElement(React.StrictMode,null,React.createElement(Home)));
