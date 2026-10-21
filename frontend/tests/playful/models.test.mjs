import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const root = process.env.AEVORA_PLAY_TEST_BUILD;
const p = await import(pathToFileURL(`${root}/playful-model.mjs`));
const t = await import(pathToFileURL(`${root}/terminal-model.mjs`));

test("default idle mode and color treatment preserve the original appearance", () => {
  assert.equal(p.DEFAULT_PLAY.mode, "classic"); assert.equal(p.DEFAULT_PLAY.treatment, "original");
  assert.equal(p.COLOR_TREATMENTS[0].filter, "none"); assert.equal(p.DEFAULT_PLAY.morph, "fluid");
});
test("invalid or corrupt preference values are normalized", () => {
  for (const value of [undefined, null, [], "junk", 8, { mode: "danger", morph: "bad", energy: Infinity }]) assert.deepEqual(p.normalizePlay(value), p.DEFAULT_PLAY);
});
test("every mode / morph / treatment round-trips without changing palettes", () => {
  for (const mode of p.PLAY_MODES) for (const morph of p.MORPH_STYLES) for (const color of p.COLOR_TREATMENTS) {
    const input = { ...p.DEFAULT_PLAY, mode: mode.id, morph: morph.id, treatment: color.id };
    assert.deepEqual(p.normalizePlay(input), input);
  }
});
test("preference normalization drops unknown object fields", () => {
  assert.deepEqual(p.normalizePlay({ ...p.DEFAULT_PLAY, endpoint: "do not persist" }), p.DEFAULT_PLAY);
});
test("bounds contain the entire 80px orb at supported small viewport sizes", () => {
  for (const [width, height] of [[1360,900],[390,844],[320,640],[667,375],[80,80]]) {
    const b = p.screenBounds(width, height); const point = p.boundPoint({x:Infinity,y:-999},b);
    assert(point.x>=0 && point.y>=0 && point.x+80<=width && point.y+80<=height);
  }
});
test("invalid saved coordinates fall back safely", () => {
  const b = p.screenBounds(800,600); assert.deepEqual(p.boundPoint({x:NaN,y:Infinity},b),{x:b.maxX,y:b.maxY});
});
test("fling bounces at edges and loses energy", () => {
  const step=p.flingStep({x:710,y:300},{x:1200,y:0},.033,p.screenBounds(800,600));
  assert(step.hit); assert(step.velocity.x<0); assert(Math.abs(step.velocity.x)<1200); assert(step.point.x<=712);
});
test("fling friction is frame-rate independent away from walls", () => {
  const simulate = hz => { let point={x:500,y:500},velocity={x:400,y:180}; for(let i=0;i<hz;i++){const step=p.flingStep(point,velocity,1/hz,p.screenBounds(5000,5000));point=step.point;velocity=step.velocity;}return point; };
  const a=simulate(30), b=simulate(60), c=simulate(144);
  assert(Math.hypot(a.x-b.x,a.y-b.y)<.001); assert(Math.hypot(c.x-b.x,c.y-b.y)<.001);
});
test("fling clamps a long frame so hidden-tab resume cannot launch the orb", () => {
  const b=p.screenBounds(1000,1000);const a=p.flingStep({x:500,y:500},{x:1000,y:100},100,b);const c=p.flingStep({x:500,y:500},{x:1000,y:100},.04,b); assert.deepEqual(a,c);
});
test("empty terminal output has no invented line or command", () => { assert.deepEqual(t.terminalLines(""), {lines:[],omitted:false}); });
test("terminal keeps literal hostile markup as text", () => {
  const raw='<script>alert(1)</script>\n<img src=x onerror=alert(1)>';const data=t.terminalLines(raw);
  assert.equal(data.lines[0].text,'<script>alert(1)</script>');assert.equal(t.cleanTerminalText(raw),raw);
});
test("basic ANSI colors and reset survive as structured safe segments", () => {
  const data=t.terminalLines('\x1b[31mError\x1b[0m normal\n\x1b[1;32mPassed\x1b[0m');
  assert.equal(data.lines[0].segments[0].tone,'red');assert.equal(data.lines[0].segments[1].tone,undefined);
  assert.equal(data.lines[1].segments[0].tone,'green');assert.equal(data.lines[1].segments[0].bold,true);
  assert.equal(t.cleanTerminalText('\x1b[31mError\x1b[0m'),'Error');
});
test("OSC hyperlinks and cursor controls are discarded, not executed", () => {
  const raw='\x1b]8;;javascript:alert(1)\x07click\x1b]8;;\x07\x1b[2Jdone';
  assert.equal(t.cleanTerminalText(raw),'clickdone');assert.equal(t.terminalLines(raw).lines[0].text,'clickdone');
});
test("unsupported truecolor parameters cannot become bold/basic colors", () => {
  const data=t.terminalLines('\x1b[38;2;1;31;32mtext\x1b[0m');assert.equal(data.lines[0].segments[0].tone,undefined);assert.equal(data.lines[0].segments[0].bold,false);
});
test("terminal normalizes CRLF and retains tabs, Unicode and empty lines", () => {
  const data=t.terminalLines('α\tβ\r\n\r\n✓ Completed\n');assert.equal(data.lines.length,3);assert.equal(data.lines[0].text,'α\tβ');assert.equal(data.lines[1].text,'');assert.equal(data.lines[2].kind,'success');
});
test("line categories are visual hints, not invented tool status", () => {
  const kinds=t.terminalLines('$ npm test\nWARNING deprecated\nError failed\nINFO loaded\nordinary output').lines.map(line=>line.kind);
  assert.deepEqual(kinds,['command','warning','error','info','plain']);
});
test("visible log rows are bounded but source text is not mutated", () => {
  const raw=Array.from({length:6000},(_,i)=>`line ${i}`).join('\n');const result=t.terminalLines(raw);
  assert(result.omitted);assert.equal(result.lines.length,t.MAX_VISIBLE_LINES);assert.equal(result.lines.at(-1).text,'line 5999');assert.equal(t.cleanTerminalText(raw),raw);
});
test("a very long single output line is bounded for rendering", () => {
  const raw='x'.repeat(1_000_000);const result=t.terminalLines(raw);assert(result.omitted);assert(result.lines[0].text.length<=t.MAX_VISIBLE_CHARACTERS);assert.equal(t.cleanTerminalText(raw).length,1_000_000);
});
