const React=require("react"),ReactDOM=require("react-dom/client");
const fixture=window.fixture={auth:true,microphones:0,stoppedTracks:0,utterances:[],recognitions:[],prompts:[],requests:[],aborts:0,commits:0,glCreated:0,glDeleted:0,glDraws:0,visualRenders:0,speechCancels:0,nativeCalls:[],listeners:{},sessions:[],savedMessages:{}};
window.__orbReactVersion=React.version;
const gl=window.WebGLRenderingContext?.prototype;
if(gl){const create=gl.createProgram,remove=gl.deleteProgram,draw=gl.drawArrays;gl.createProgram=function(...a){fixture.glCreated++;return create.apply(this,a)};gl.deleteProgram=function(...a){fixture.glDeleted++;return remove.apply(this,a)};gl.drawArrays=function(...a){fixture.glDraws++;return draw.apply(this,a)}}
if(window.__orbForceNoWebGL){const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.includes("webgl")?null:get.call(this,type,...args)}}
class Recognition{constructor(){fixture.recognitions.push(this)}start(){this.onstart?.()}abort(){this.aborted=true;this.onend?.()}stop(){this.onend?.()}result(text,final=true){this.onresult?.({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:final})]})}}
class Utterance{constructor(text){this.text=text}}
const voices=[{name:"English natural voice",lang:"en-US",default:true,localService:true},{name:"English alternate voice",lang:"en-GB",localService:true}];
Object.defineProperty(window,"speechSynthesis",{value:Object.assign(new EventTarget(),{paused:false,getVoices:()=>voices,resume(){},cancel(){fixture.speechCancels++},speak(value){fixture.utterances.push(value)}}),configurable:true});
window.SpeechSynthesisUtterance=Utterance;window.SpeechRecognition=window.__orbUnsupportedSpeech?undefined:Recognition;
if(window.__orbUnsupportedSpeech)window.webkitSpeechRecognition=undefined;
Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:async()=>{
 fixture.microphones++;if(fixture.permissionDenied)throw new DOMException("Permission denied","NotAllowedError");
 let stream;
 if(window.__orbRealAnalyser){
  // Real WebAudio signal; only the source is synthetic, not an actual microphone.
  const context=new AudioContext();await context.resume();const oscillator=context.createOscillator(),gain=context.createGain(),destination=context.createMediaStreamDestination();
  gain.gain.value=0;oscillator.frequency.value=240;oscillator.connect(gain).connect(destination);oscillator.start();stream=destination.stream;
  fixture.setVolume=value=>gain.gain.setValueAtTime(value,context.currentTime);
  for(const track of stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{fixture.stoppedTracks++;stop();oscillator.stop();void context.close()}}
 }else stream={getTracks:()=>[{stop(){fixture.stoppedTracks++}}]};
 if(fixture.delayPermission)return new Promise(resolve=>{fixture.grantPermission=()=>resolve(stream)});return stream;
}}});
if(!window.__orbRealAnalyser){window.AudioContext=undefined;window.webkitAudioContext=undefined}
if(window.__orbNative){window.__TAURI__={core:{invoke:async(command,args)=>{fixture.nativeCalls.push({command,args});if(fixture.nativeFail)throw new Error("Native window action failed");if(command==="is_pet_window_open")return fixture.petVisible||false;if(command==="open_pet_window")fixture.petVisible=true;if(command==="close_pet_window")fixture.petVisible=false;return undefined}},event:{listen:async(name,callback)=>{(fixture.listeners[name]||=[]).push(callback);return()=>fixture.listeners[name]=fixture.listeners[name].filter(item=>item!==callback)}}};fixture.emitNative=(name,payload)=>fixture.listeners[name]?.forEach(callback=>callback({payload}))}
fixture.finishReply=(text="That makes sense. Let’s take it one step at a time.")=>{fixture.stream.onChunk(text);fixture.stream.onDone?.();fixture.resolveRequest?.()};
fixture.speakStart=()=>fixture.utterances.at(-1)?.onstart?.();
fixture.speakEnd=()=>{for(let i=0;i<fixture.utterances.length;i++){const u=fixture.utterances[i];if(!u.__ended){u.__ended=true;u.onstart?.();u.onend?.()}}};
const Home=require("apps/web/app/page").default,Pet=require("apps/web/app/pet/page").default,{OrbVisual}=require("apps/web/components/orb/OrbVisual");
function App(){const [view,setView]=React.useState(window.__orbView||"chat"),[state,setState]=React.useState(0),[theme,setTheme]=React.useState(1),[tick,setTick]=React.useState(0);const signal=React.useRef({audio:0,word:0,wordAt:0});fixture.setView=setView;fixture.setState=setState;fixture.setTheme=setTheme;fixture.signal=signal;fixture.rerender=()=>setTick(x=>x+1);React.useEffect(()=>{fixture.commits++});if(view==="pet")return React.createElement(Pet);if(view==="visual")return React.createElement("main",{className:"fixtureVisual","data-tick":tick},React.createElement(OrbVisual,{size:300,state,theme,signal,showWaveform:true,label:"Test orb",onActivate:()=>setState((state+1)%4)}));return React.createElement(Home)}
const root=ReactDOM.createRoot(document.getElementById("root"));root.render(React.createElement(React.StrictMode,null,React.createElement(App)));fixture.unmount=()=>root.unmount();
