const React=require('react'), ReactDOM=require('react-dom/client');
const f=window.eyeFixture={metrics:{renders:0,reads:0,frames:0},timers:new Set(),frames:new Set(),reactVersion:React.version};
const timeout=window.setTimeout.bind(window),clear=window.clearTimeout.bind(window),raf=window.requestAnimationFrame.bind(window),caf=window.cancelAnimationFrame.bind(window);
window.setTimeout=(fn,delay,...args)=>{let id=timeout(()=>{f.timers.delete(id);fn(...args)},delay);f.timers.add(id);return id};
window.clearTimeout=id=>{f.timers.delete(id);clear(id)};
window.requestAnimationFrame=fn=>{let id=raf(time=>{f.frames.delete(id);f.metrics.frames++;fn(time)});f.frames.add(id);return id};
window.cancelAnimationFrame=id=>{f.frames.delete(id);caf(id)};
const rect=HTMLElement.prototype.getBoundingClientRect;
HTMLElement.prototype.getBoundingClientRect=function(){if(this.classList.contains('eye-test-host'))f.metrics.reads++;return rect.call(this)};
const {OrbEyes}=require('apps/web/components/orb/OrbEyes'),{OrbVisual}=require('apps/web/components/orb/OrbVisual'),{useDialogFocus}=require('apps/web/hooks/useDialogFocus');
function Eyes({state,mood,moving,index}){const host=React.useRef(null);return React.createElement('div',{ref:host,className:'eye-test-host','data-eye-host':index},React.createElement('button',{type:'button','aria-label':'Test eye host '+index},'Activate'),React.createElement(OrbEyes,{hostRef:host,state,mood,isMoving:moving}));}
function Dialog({tick,onClose}){const ref=useDialogFocus(true,onClose);return React.createElement('section',{ref,tabIndex:-1,role:'dialog',className:'dialog'},React.createElement('input',{'aria-label':'Focus test',defaultValue:'Keep my caret'}),React.createElement('button',{onClick:onClose},'Close '+tick));}
function App(){const [state,setState]=React.useState(0),[mood,setMood]=React.useState(undefined),[moving,setMoving]=React.useState(false),[shown,setShown]=React.useState(true),[visual,setVisual]=React.useState(false),[dialog,setDialog]=React.useState(false),[tick,setTick]=React.useState(0);
Object.assign(f,{setState,setMood,setMoving,setShown,setVisual,setDialog,rerender:()=>setTick(t=>t+1)});
return React.createElement(React.Fragment,null,React.createElement('main',null,shown&&(visual?[['normal','Ready'],['curious','Listening'],['focused','Thinking'],['content','Content'],['happy','Happy'],['sleepy','Sleepy']].map(([expression,label],index)=>React.createElement('div',{key:index},React.createElement(OrbVisual,{size:220,state:index===1?1:index===2?2:0,label}),React.createElement('p',{className:'caption'},label))):[0,1].map(index=>React.createElement(Eyes,{key:index,index,state,mood,moving})))),dialog&&React.createElement(Dialog,{tick,onClose:()=>{f.closedAt=tick;setDialog(false)}}));}
let root;f.mount=()=>{root=ReactDOM.createRoot(document.getElementById('root'));root.render(React.createElement(React.StrictMode,null,React.createElement(App)))};f.unmount=()=>root.unmount();f.mount();
