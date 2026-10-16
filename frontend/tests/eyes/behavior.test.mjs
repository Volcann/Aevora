import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const { EyeReactions, StrokeGesture, pointerGaze, restingGaze, restingMood, canBlink, isEyeMood, EYE_PRIORITY: P } = await import(pathToFileURL(process.env.AEVORA_EYE_MODULE));
function setup() {
  let now = 0, id = 0;
  const pending = new Map(), changes = [];
  const clock = { setTimer(fn, delay) { pending.set(++id, { fn, at: now + delay }); return id; }, clearTimer(key) { pending.delete(key); } };
  const reactions = new EyeReactions(mood => changes.push(mood), clock);
  const advance = ms => {
    const end = now + ms;
    while (true) {
      const next = [...pending].filter(([, job]) => job.at <= end).sort((a,b) => a[1].at-b[1].at)[0];
      if (!next) break;
      pending.delete(next[0]); now = next[1].at; next[1].fn();
    }
    now = end;
  };
  return { reactions, advance, pending, changes };
}
test("all six original moods plus four eye-only moods remain valid", () => {
  for (const mood of ["normal","happy","wink","heart","surprised","dizzy","curious","focused","sleepy","content"]) assert.equal(isEyeMood(mood),true);
  for (const value of [null, undefined, {}, "__proto__", "toString", "angry", 1]) assert.equal(isEyeMood(value),false);
});
test("reactions expire instead of getting stuck after a React mood update", () => {
  const f=setup(); f.reactions.react("heart", 2200); f.advance(2199); assert.equal(f.reactions.mood,"heart"); f.advance(1);
  assert.deepEqual(f.changes,["heart","normal"]); assert.equal(f.pending.size,0);
});
test("replacing an expression cancels its old timer", () => {
  const f=setup(); f.reactions.react("wink", 1100); f.advance(500); f.reactions.react("heart",2200); f.advance(700);
  assert.equal(f.reactions.mood,"heart"); assert.equal(f.pending.size,1); f.advance(1500); assert.equal(f.reactions.mood,"normal");
});
test("a thousand movement events cannot starve recovery or allocate a thousand timers", () => {
  const f=setup(); for(let i=0;i<1000;i++) f.reactions.react("happy",1400,P.movement);
  assert.equal(f.pending.size,1); assert.deepEqual(f.changes,["happy"]); f.advance(1400); assert.equal(f.reactions.mood,"normal");
});
test("movement and idle gestures never override affection", () => {
  const f=setup(); f.reactions.react("heart",2200,P.affection);
  for(const [mood,p] of [["happy",P.movement],["curious",P.attention],["sleepy",P.idle]]) assert.equal(f.reactions.react(mood,1000,p),false);
  assert.equal(f.reactions.mood,"heart");
});
test("explicit tricks override automatic reactions", () => {
  const f=setup(); f.reactions.react("dizzy",2000,P.shake); assert.equal(f.reactions.react("wink",1200,P.explicit),true); assert.equal(f.reactions.mood,"wink");
});
test("an explicit normal event clears an active expression", () => {
  const f=setup(); f.reactions.react("heart"); f.reactions.react("normal"); assert.equal(f.pending.size,0); assert.deepEqual(f.changes,["heart","normal"]);
});
test("same-mood priority upgrades do not renew the deadline", () => {
  const f=setup(); f.reactions.react("happy",1400,P.movement); f.advance(500); f.reactions.react("happy",6000,P.explicit);
  assert.equal(f.reactions.react("dizzy",2000,P.shake),false); f.advance(900); assert.equal(f.reactions.mood,"normal");
});
test("invalid durations cannot create immortal or zero-length reactions", () => {
  for(const [input,expected] of [[NaN,1600],[Infinity,1600],[-100,250],[0,250],[1e12,8000]]) {
    const f=setup(); f.reactions.react("wink",input); f.advance(expected-1); assert.equal(f.reactions.mood,"wink"); f.advance(1); assert.equal(f.reactions.mood,"normal");
  }
});
test("unknown runtime moods are ignored", () => { const f=setup(); assert.equal(f.reactions.react("toString"),false); assert.equal(f.pending.size,0); });
test("dispose cancels all deadlines and rejects future events", () => {
  const f=setup(); f.reactions.react("heart"); f.reactions.dispose(); f.reactions.dispose(); f.advance(9000);
  assert.equal(f.pending.size,0); assert.deepEqual(f.changes,["heart"]); assert.equal(f.reactions.react("wink"),false);
});
test("three deliberate reversals make a petting gesture", () => {
  const g=new StrokeGesture(900,3); const result=[0,20,0,20,0].map((x,i)=>g.sample(x,i*100,5)); assert.deepEqual(result,[false,false,false,false,true]);
});
test("one-direction travel is not petting", () => {
  const g=new StrokeGesture(900,3); for(let i=0;i<1000;i++) assert.equal(g.sample(i,i,5),false);
});
test("pointer jitter is not affection", () => {
  const g=new StrokeGesture(900,3); for(let i=0;i<1000;i++) assert.equal(g.sample(i%2,i,5),false);
});
test("slow or stale strokes do not combine across pauses", () => {
  const g=new StrokeGesture(900,3); for(let i=0;i<20;i++) assert.equal(g.sample(i%2*30,i*1000,5),false);
});
test("gesture reset separates dragging from petting", () => {
  const g=new StrokeGesture(900,3); [0,20,0,20].forEach((x,i)=>g.sample(x,i*100,5)); g.reset(); assert.equal(g.sample(0,400,5),false);
});
test("gesture histories remain bounded under sustained input", () => {
  const g=new StrokeGesture(750,4); for(let i=0;i<20000;i++) {g.sample(i%2*20,i*10,5); assert.ok(g.turns.length<4);}
});
test("invalid gesture coordinates are harmless", () => {
  const g=new StrokeGesture(900,3); assert.equal(g.sample(NaN,0,5),false); assert.equal(g.sample(1,Infinity,5),false);
});
test("gaze retains the original horizontal, vertical and parallax bounds", () => {
  for(let x=-800;x<=800;x+=11) for(let y=-800;y<=800;y+=13) {
    const g=pointerGaze(x,y); assert.ok(Math.abs(g.left)<=4.15 && Math.abs(g.right)<=4.15); assert.ok(Math.abs(g.y)<=4); assert.ok(Math.abs(g.faceX)<=1.088 && Math.abs(g.faceY)<=1.28);
  }
});
test("center gaze converges symmetrically without the original rightward twitch", () => { const g=pointerGaze(0,0); assert.equal(g.left,-g.right); assert.equal(g.faceX,0); });
test("offscreen and invalid pointer coordinates return neutral gaze", () => {
  for(const [x,y] of [[NaN,0],[Infinity,1],[800,0]]) assert.deepEqual(pointerGaze(x,y),{left:0,right:0,y:0,faceX:0,faceY:0});
});
test("listening/thinking/speaking reflect existing states, without interpreting streamed content", () => {
  assert.equal(restingMood(0),"normal"); assert.equal(restingMood(1),"curious"); assert.equal(restingMood(2),"focused"); assert.equal(restingMood(3),"normal");
  assert.ok(restingGaze(2).y<0); assert.equal(restingGaze(2,true).left,-restingGaze(2).left);
});
test("only open-eye expressions participate in natural blinking", () => {
  for(const mood of ["normal","focused","curious","sleepy","content"]) assert.equal(canBlink(mood),true);
  for(const mood of ["heart","happy","wink","surprised","dizzy"]) assert.equal(canBlink(mood),false);
});
