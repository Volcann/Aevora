import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
const load = (path) => import(pathToFileURL(join(process.env.ORB_TEST_BUILD_DIR, "apps/web", path)));
const { clamp, damp, audioEnvelope, toOrbState } = await load("components/orb/core/orb-model.mjs");
const { GoogleSpeechRecognizer, GoogleSpeechSynthesizer } = await load("lib/speech.mjs");
const { VoiceSession } = await load("components/orb/core/voice-session.mjs");
const { normalizeOrbTheme, getSavedOrbTheme, saveOrbTheme } = await load("lib/orbTheme.mjs");

function environment() {
  const tracks = [], recognitions = [], utterances = [];
  let mediaCalls = 0, globalCancels = 0;
  const voice = { name: "Test English Male", lang: "en-US", default: true, localService: true, voiceURI: "test" };
  const synth = Object.assign(new EventTarget(), {
    getVoices: () => [voice], paused: false, resume() {},
    speak(utterance) { utterances.push(utterance); },
    cancel() { globalCancels++; },
  });
  class Recognition {
    constructor() { recognitions.push(this); }
    start() { this.onstart?.(); }
    abort() { this.aborted = true; this.onend?.(); }
    stop() { this.onend?.(); }
    result(final = "", interim = "") {
      const results = [];
      if (final) results.push(Object.assign([{ transcript: final }], { isFinal: true }));
      if (interim) results.push(Object.assign([{ transcript: interim }], { isFinal: false }));
      this.onresult?.({ resultIndex: 0, results });
    }
  }
  class Utterance { constructor(text) { this.text = text; } }
  const win = Object.assign(new EventTarget(), { speechSynthesis: synth, SpeechSynthesisUtterance: Utterance, SpeechRecognition: Recognition });
  const mediaDevices = { async getUserMedia() {
    mediaCalls++;
    const track = { stopped: false, stop() { this.stopped = true; } };
    tracks.push(track);
    return { getTracks: () => [track] };
  } };
  const store = new Map();
  Object.assign(globalThis, { window: win, document: { hidden: false }, SpeechSynthesisUtterance: Utterance,
    localStorage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { mediaDevices } });
  return { win, tracks, recognitions, utterances, mediaDevices, store, get mediaCalls() { return mediaCalls; }, get globalCancels() { return globalCancels; } };
}
const completeSpeech = (env) => {
  for (let index = 0; index < env.utterances.length; index++) {
    const utterance = env.utterances[index];
    utterance.onstart?.(); utterance.onend?.();
  }
};
function session(t, options = {}) {
  const instance = new VoiceSession();
  instance.configure({ onPrompt: () => undefined, ...options });
  instance.attach();
  t.after(() => instance.detach());
  return instance;
}

test("visual input validation clamps invalid audio, states and themes", () => {
  for (const value of [NaN, Infinity, -Infinity, -8]) assert.equal(clamp(value), 0);
  assert.equal(clamp(2), 1);
  assert.equal(toOrbState(4), 0);
  assert.equal(toOrbState(3), 3);
  for (const value of [NaN, 4.2, -1, 6, Infinity]) assert.equal(normalizeOrbTheme(value), 5);
  for (let theme = 0; theme < 6; theme++) assert.equal(normalizeOrbTheme(theme), theme);
  assert.equal(audioEnvelope(0), 0);
  assert.equal(audioEnvelope(0.9), 1);
});
test("damping is independent of frame rate", () => {
  const at = (fps) => { let value = 0; for (let i = 0; i < fps; i++) value = damp(value, 1, 5, 1 / fps); return value; };
  assert.ok(Math.abs(at(30) - at(120)) < 1e-10);
});
test("theme persistence sanitizes malformed values and dispatches without storage", () => {
  const env = environment();
  env.store.set("aevora_orb_migrated_rgb", "true");
  for (const saved of ["3junk", "", "  ", "Infinity", "-1", "6"]) {
    env.store.set("aevora-orb-theme", saved);
    assert.equal(getSavedOrbTheme(), 5);
  }
  let detail;
  window.addEventListener("aevora-orb-theme-change", (event) => { detail = event.detail; });
  globalThis.localStorage.setItem = () => { throw new Error("Blocked"); };
  saveOrbTheme(4);
  assert.equal(detail.themeIndex, 4);
});
test("the supplied RGB default and one-time theme migration remain unchanged", () => {
  const env = environment();
  env.store.set("aevora-orb-theme", "2");
  assert.equal(getSavedOrbTheme(), 5);
  assert.equal(env.store.get("aevora_orb_migrated_rgb"), "true");
  assert.equal(env.store.get("aevora-orb-theme"), "5");
  saveOrbTheme(2);
  assert.equal(getSavedOrbTheme(), 2);
});
test("cancel and beginStream never emit natural completion", () => {
  environment(); const synth = new GoogleSpeechSynthesizer(); let ended = 0;
  synth.setCallbacks({ onEnd: () => ended++ });
  synth.beginStream(); synth.cancel(); synth.dispose();
  assert.equal(ended, 0);
});
test("disposing a silent orb does not cancel another orb's playback", () => {
  const env = environment(); const synth = new GoogleSpeechSynthesizer(); synth.dispose();
  assert.equal(env.globalCancels, 0);
});
test("late canceled utterances cannot complete or start another turn", () => {
  const env = environment(); const synth = new GoogleSpeechSynthesizer(); let starts = 0, ends = 0;
  synth.setCallbacks({ onStart: () => starts++, onEnd: () => ends++ });
  synth.beginStream(); synth.enqueueStreamChunk("A complete answer.");
  const lateStart = env.utterances[0].onstart, lateEnd = env.utterances[0].onend;
  synth.cancel(); lateStart(); lateEnd();
  assert.equal(starts, 0); assert.equal(ends, 0); assert.equal(env.globalCancels, 1);
  synth.dispose();
});
test("voice subscriptions do not overwrite browser event properties", () => {
  environment(); const original = () => {}; window.speechSynthesis.onvoiceschanged = original;
  const one = new GoogleSpeechSynthesizer(), two = new GoogleSpeechSynthesizer();
  assert.equal(window.speechSynthesis.onvoiceschanged, original); one.dispose(); two.dispose();
});
test("spoken replies include every sentence, without the old two-sentence cutoff", () => {
  const env = environment(); const synth = new GoogleSpeechSynthesizer();
  synth.beginStream(); synth.enqueueStreamChunk("One short sentence. Another sentence. A third sentence."); synth.flushStream();
  completeSpeech(env);
  assert.equal(env.utterances.length, 3); synth.dispose();
});
test("speech playback errors are reported without restarting microphone", () => {
  const env = environment(); const synth = new GoogleSpeechSynthesizer(); let error;
  synth.setCallbacks({ onError: (value) => { error = value; } });
  synth.beginStream(); synth.enqueueStreamChunk("Hello world.");
  env.utterances[0].onerror({ error: "not-allowed" });
  assert.match(error.message, /playback failed/i); assert.equal(env.mediaCalls, 0); synth.dispose();
});
test("closing during microphone permission releases the eventual media stream", async () => {
  const env = environment(); let resolve;
  env.mediaDevices.getUserMedia = () => new Promise((done) => { resolve = done; });
  const recognizer = new GoogleSpeechRecognizer(); const pending = recognizer.start(); recognizer.abort();
  let stopped = false; resolve({ getTracks: () => [{ stop() { stopped = true; } }] }); await pending;
  assert.equal(stopped, true); assert.equal(env.recognitions.length, 0); assert.equal(recognizer.getIsListening(), false);
});
test("stopping microphone releases all tracks and the captured transcript", async () => {
  const env = environment(); const recognizer = new GoogleSpeechRecognizer(); await recognizer.start();
  env.recognitions[0].result("First clause", "and the rest");
  assert.equal(recognizer.stop(), "First clause and the rest");
  assert.ok(env.tracks.every((track) => track.stopped)); recognizer.abort();
});
test("auto-send preserves trailing interim words and sends only once", async (t) => {
  const env = environment(); t.mock.timers.enable({ apis: ["setTimeout"] }); const prompts = [];
  const recognizer = new GoogleSpeechRecognizer({ onFinal: (text) => prompts.push(text) }); await recognizer.start();
  env.recognitions[0].result("First clause", "and the rest"); t.mock.timers.tick(2501); t.mock.timers.tick(9000);
  assert.deepEqual(prompts, ["First clause and the rest"]); assert.ok(env.tracks.every((track) => track.stopped)); recognizer.abort();
});
test("network recognition errors stop microphone and remain visible", async () => {
  const env = environment(); let error;
  const recognizer = new GoogleSpeechRecognizer({ onError: (value) => { error = value; } }); await recognizer.start();
  env.recognitions[0].onerror({ error: "network" }); assert.match(error.message, /network/);
  assert.ok(env.tracks.every((track) => track.stopped)); assert.equal(recognizer.getIsListening(), false);
});
test("unsupported speech recognition fails with a useful message", async () => {
  const env = environment(); delete env.win.SpeechRecognition;
  await assert.rejects(new GoogleSpeechRecognizer().start(), /not supported/);
});
test("mounting a voice session does not request microphone access", (t) => {
  const env = environment(); session(t); assert.equal(env.mediaCalls, 0); assert.equal(env.globalCancels, 0);
});
test("microphone permission rejection becomes a visible error", async (t) => {
  const env = environment(); env.mediaDevices.getUserMedia = async () => { throw new DOMException("Denied", "NotAllowedError"); };
  const voice = session(t); await voice.startListening();
  assert.equal(voice.getSnapshot().state, 0); assert.equal(voice.getSnapshot().requesting, false); assert.match(voice.getSnapshot().error, /permission was denied/);
});
test("rapid repeated starts do not acquire multiple microphones", async (t) => {
  const env = environment(); const voice = session(t);
  await Promise.all([voice.startListening(), voice.startListening(), voice.startListening()]);
  assert.equal(env.mediaCalls, 1); assert.equal(env.recognitions.length, 1);
});
test("stream chunks do not claim the orb is speaking before actual playback", async (t) => {
  const env = environment(); let callbacks;
  const voice = session(t, { onPrompt: (_text, options) => { callbacks = options; } });
  await voice.send("Question"); callbacks.onChunk("A real reply.");
  assert.equal(voice.getSnapshot().state, 2);
  env.utterances[0].onstart(); assert.equal(voice.getSnapshot().state, 3);
  callbacks.onDone(); completeSpeech(env); assert.equal(voice.getSnapshot().state, 0); assert.equal(env.mediaCalls, 0);
});
test("stopping cancels requests and ignores every late stream callback", async (t) => {
  const env = environment(); let callbacks, stopped = 0;
  const voice = session(t, { onPrompt: (_text, options) => { callbacks = options; }, onStopStreaming: () => stopped++ });
  await voice.send("Question"); voice.stop(); callbacks.onChunk("Late answer."); callbacks.onDone();
  assert.equal(callbacks.signal.aborted, true); assert.equal(stopped, 1); assert.equal(voice.getSnapshot().response, ""); assert.equal(voice.getSnapshot().state, 0); assert.equal(env.utterances.length, 0);
});
test("a rejected prompt returns to idle with an actionable error", async (t) => {
  environment(); const voice = session(t, { onPrompt: async () => { throw new Error("Connection failed"); } });
  await voice.send("Question"); assert.equal(voice.getSnapshot().streaming, false); assert.equal(voice.getSnapshot().state, 0); assert.equal(voice.getSnapshot().error, "Connection failed");
});
test("promise-based prompts finish even when onDone is omitted", async (t) => {
  const env = environment(); const voice = session(t, { onPrompt: async (_text, options) => { options.onChunk("Finished reply"); } });
  await voice.send("Question"); completeSpeech(env);
  assert.equal(voice.getSnapshot().streaming, false); assert.equal(voice.getSnapshot().state, 0);
});
test("callback-based void prompts stay active until onDone", async (t) => {
  environment(); let callbacks; const voice = session(t, { onPrompt: (_text, options) => { callbacks = options; } });
  await voice.send("Question"); assert.equal(voice.getSnapshot().streaming, true);
  callbacks.onChunk("Reply"); callbacks.onDone(); assert.equal(voice.getSnapshot().streaming, false);
});
test("empty successful responses do not leave a thinking orb", async (t) => {
  environment(); const voice = session(t, { onPrompt: async () => {} }); await voice.send("Question");
  assert.equal(voice.getSnapshot().state, 0); assert.match(voice.getSnapshot().error, /No response/);
});
test("continuous mode restarts once after natural speech, never after Stop", async (t) => {
  const env = environment(); t.mock.timers.enable({ apis: ["setTimeout"] });
  const voice = session(t, { onPrompt: async (_text, options) => options.onChunk("A complete reply.") });
  voice.setContinuous(true); await voice.send("Question"); completeSpeech(env);
  assert.equal(env.mediaCalls, 0); t.mock.timers.tick(601); await Promise.resolve(); await Promise.resolve();
  assert.equal(env.mediaCalls, 1); voice.stop(); t.mock.timers.tick(10000); assert.equal(env.mediaCalls, 1);
});
test("Stop clears a scheduled continuous restart", async (t) => {
  const env = environment(); t.mock.timers.enable({ apis: ["setTimeout"] });
  const voice = session(t, { onPrompt: async (_text, options) => options.onChunk("A complete reply.") });
  voice.setContinuous(true); await voice.send("Question"); completeSpeech(env); voice.stop(); t.mock.timers.tick(10000);
  assert.equal(env.mediaCalls, 0);
});
test("updating parent callbacks cannot restart or cancel active speech", async (t) => {
  const env = environment(); const voice = session(t, { onPrompt: async (_text, options) => options.onChunk("A complete reply.") });
  await voice.send("Question"); env.utterances[0].onstart();
  for (let i = 0; i < 100; i++) voice.configure({ onPrompt: () => {} });
  assert.equal(voice.getSnapshot().state, 3); assert.equal(env.globalCancels, 0);
});
test("muted replies remain readable and return to idle without playback", async (t) => {
  const env = environment(); const voice = session(t, { onPrompt: async (_text, options) => options.onChunk("A text-only reply.") });
  voice.setMuted(true); await voice.send("Question"); assert.equal(env.utterances.length, 0);
  assert.equal(voice.getSnapshot().response, "A text-only reply."); assert.equal(voice.getSnapshot().state, 0);
});
test("detach invalidates callbacks and releases microphone tracks", async (t) => {
  const env = environment(); const voice = session(t); await voice.startListening(); voice.detach();
  assert.ok(env.tracks.every((track) => track.stopped)); assert.equal(voice.getSnapshot().state, 0);
});

test("a call starts only after user action and records connection time", async (t) => {
  const env = environment(); const voice = session(t);
  assert.equal(voice.getSnapshot().callActive,false); assert.equal(env.mediaCalls,0);
  await voice.startCall();
  assert.equal(voice.getSnapshot().callActive,true); assert.equal(voice.getSnapshot().continuous,true);
  assert.ok(voice.getSnapshot().startedAt > 0); assert.equal(voice.getSnapshot().state,1);
});
test("microphone mute releases capture without sending partial speech", async (t) => {
  const env=environment(); let sends=0;const voice=session(t,{onPrompt:()=>{sends++;}});
  await voice.startCall();env.recognitions[0].result("an unfinished thought");voice.setMicMuted(true);
  assert.equal(sends,0);assert.ok(env.tracks.every(track=>track.stopped));
  assert.equal(voice.getSnapshot().micMuted,true);assert.equal(voice.getSnapshot().callActive,true);assert.equal(voice.getSnapshot().state,0);
});
test("unmuting an active call reacquires capture exactly once", async (t) => {
  const env=environment();const voice=session(t);await voice.startCall();voice.setMicMuted(true);voice.setMicMuted(false);voice.setMicMuted(false);
  await Promise.resolve();await Promise.resolve();assert.equal(env.mediaCalls,2);assert.equal(voice.getSnapshot().state,1);
});
test("speaker mute does not mute the microphone", async (t) => {
  const env=environment();const voice=session(t);await voice.startCall();voice.setMuted(true);
  assert.equal(voice.getSnapshot().state,1);assert.equal(voice.getSnapshot().micMuted,false);assert.equal(env.tracks[0].stopped,false);
});
test("hanging up clears call state and pending resume", async (t) => {
  const env=environment();t.mock.timers.enable({apis:["setTimeout"]});const voice=session(t,{onPrompt:async(_text,options)=>options.onChunk("Hello there.")});
  await voice.startCall();await voice.send("Question");completeSpeech(env);voice.endCall();t.mock.timers.tick(10000);
  assert.equal(env.mediaCalls,1);assert.equal(voice.getSnapshot().callActive,false);assert.equal(voice.getSnapshot().startedAt,null);assert.equal(voice.getSnapshot().continuous,false);
});
test("native hidden-window fail-safe releases microphone and ends call", async (t) => {
  const env=environment();const voice=session(t);await voice.startCall();window.dispatchEvent(new Event("aevora:pet-hidden"));
  assert.equal(voice.getSnapshot().callActive,false);assert.ok(env.tracks.every(track=>track.stopped));
});
test("only one mounted voice session can own capture", async (t) => {
  const env=environment();const one=session(t),two=session(t);await one.startCall();await two.startCall();
  assert.equal(one.getSnapshot().callActive,false);assert.equal(two.getSnapshot().callActive,true);assert.equal(env.tracks[0].stopped,true);assert.equal(env.tracks[1].stopped,false);
});
test("StrictMode attach-detach-attach does not leak listeners or voice resources", async (t) => {
  const env=environment();const voice=session(t);voice.detach();voice.attach();await voice.startCall();
  assert.equal(env.mediaCalls,1);voice.detach();assert.ok(env.tracks.every(track=>track.stopped));
});
test("unsupported native recognition cannot leave a fake active call", async (t) => {
  const env=environment();delete env.win.SpeechRecognition;const voice=session(t);await voice.startCall();
  assert.equal(voice.getSnapshot().recognitionSupported,false);assert.equal(voice.getSnapshot().callActive,false);assert.equal(env.mediaCalls,0);assert.match(voice.getSnapshot().error,/not supported/);
});
test("call transcript retains user and assistant turns without raw response truncation", async(t)=>{
  environment();const answer=Array.from({length:80},(_,i)=>`word${i}`).join(" ")+".";
  const voice=session(t,{onPrompt:async(_text,options)=>options.onChunk(answer)});await voice.send("A long question");
  const turns=voice.getSnapshot().turns;assert.equal(turns.length,2);assert.equal(turns[0].role,"user");assert.equal(turns[1].text,answer);
});
test("speech boundaries create a timed shared impulse without React audio updates",async(t)=>{
  const env=environment();const voice=session(t,{onPrompt:async(_text,options)=>options.onChunk("A complete reply.")});
  await voice.send("Question");const utterance=env.utterances[0];utterance.onstart();utterance.onboundary({name:"word",charIndex:2,charLength:8});
  assert.ok(voice.signal.current.word>0);assert.ok(voice.signal.current.wordAt>0);
});
