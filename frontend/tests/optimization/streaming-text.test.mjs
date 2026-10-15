import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const { StreamingText } = await import(pathToFileURL(process.env.AEVORA_STREAM_TEST_MODULE).href);
function fixture(boosted = true) {
  const frames = new Map(), texts = [], completions = [];
  let next = 0;
  const stream = new StreamingText({
    boosted, onText: (text) => texts.push(text), onComplete: (text) => completions.push(text),
    requestFrame: (callback) => { frames.set(++next, callback); return next; },
    cancelFrame: (id) => frames.delete(id),
  });
  const tick = () => {
    const batch = [...frames]; frames.clear();
    for (const [, callback] of batch) callback(0);
  };
  const drain = () => { let limit = 10000; while (frames.size && --limit) tick(); assert.ok(limit, "RAF loop did not settle"); };
  return { stream, frames, texts, completions, tick, drain };
}
function originalSequence(text, boosted) {
  const result = []; let displayed = 0;
  while (displayed < text.length) {
    const diff = text.length - displayed;
    const step = boosted
      ? (diff > 35 ? Math.ceil(diff / 6) : diff > 10 ? 2 : 1)
      : (diff > 50 ? Math.ceil(diff / 10) : diff > 15 ? 2 : 1);
    displayed = Math.min(text.length, displayed + step);
    result.push(text.slice(0, displayed));
  }
  return result;
}
for (const boosted of [true, false]) {
  test(`preserves every original typewriter frame (${boosted ? "boost" : "normal"})`, () => {
    for (const length of [0, 1, 10, 11, 15, 16, 35, 36, 50, 51, 120, 10000]) {
      const f = fixture(boosted), text = "x".repeat(length);
      f.stream.append(text); f.stream.complete(); f.drain();
      assert.deepEqual(f.texts, originalSequence(text, boosted));
      assert.deepEqual(f.completions, [text]);
    }
  });
}
test("transport completion drains the full backlog before resolving", async () => {
  const f = fixture(); let finished = false;
  f.stream.finished.then(() => { finished = true; });
  const text = "The transport can finish well before the typewriter finishes. ".repeat(40);
  f.stream.append(text); f.stream.complete();
  await Promise.resolve(); assert.equal(finished, false); assert.deepEqual(f.completions, []);
  f.tick(); assert.ok(f.texts.at(-1).length < text.length);
  f.drain(); await f.stream.finished;
  assert.equal(f.texts.at(-1), text); assert.deepEqual(f.completions, [text]); assert.equal(finished, true);
});
test("does not poll empty animation frames while awaiting another chunk", () => {
  const f = fixture(); f.stream.append("hello"); f.drain();
  assert.equal(f.frames.size, 0); assert.deepEqual(f.completions, []);
  f.stream.append(" again"); assert.equal(f.frames.size, 1); f.drain();
  assert.equal(f.texts.at(-1), "hello again"); assert.equal(f.frames.size, 0);
  f.stream.complete(); assert.deepEqual(f.completions, ["hello again"]);
});
test("bursts of network chunks share a single pending frame", () => {
  const f = fixture(); for (const c of ["one", "two", "three"]) f.stream.append(c);
  assert.equal(f.frames.size, 1); f.stream.complete(); f.drain();
  assert.deepEqual(f.completions, ["onetwothree"]);
});
test("cancellation before the first frame prevents all presentation", async () => {
  const f = fixture(); f.stream.append("do not render"); f.stream.cancel();
  f.drain(); await f.stream.finished;
  assert.deepEqual(f.texts, []); assert.deepEqual(f.completions, []); assert.equal(f.frames.size, 0);
});
test("cancellation still works after the server finishes", async () => {
  const f = fixture(); f.stream.append("queued ".repeat(50)); f.stream.complete(); f.tick();
  const before = [...f.texts]; f.stream.cancel(); f.drain(); await f.stream.finished;
  assert.deepEqual(f.texts, before); assert.deepEqual(f.completions, []);
});
test("late chunks and duplicate completion callbacks cannot revive cancellation", () => {
  const f = fixture(); f.stream.cancel(); f.stream.append("stale"); f.stream.complete(); f.stream.complete();
  assert.equal(f.frames.size, 0); assert.deepEqual(f.completions, []);
});
test("empty replies finish once without an unnecessary frame", async () => {
  const f = fixture(); f.stream.append(""); f.stream.complete(); f.stream.complete(); f.stream.cancel();
  await f.stream.finished; assert.deepEqual(f.completions, [""]); assert.equal(f.frames.size, 0);
});
test("duplicate server completion during the backlog commits once", () => {
  const f = fixture(); f.stream.append("hello world"); f.stream.complete(); f.stream.complete(); f.drain();
  f.stream.complete(); f.stream.append("late data");
  assert.deepEqual(f.completions, ["hello world"]); assert.equal(f.frames.size, 0);
});
test("a late callback from a cancelled frame is harmless", () => {
  const f = fixture(); f.stream.append("stale frame"); const callback = [...f.frames.values()][0];
  f.stream.cancel(); callback(0); assert.deepEqual(f.texts, []); assert.deepEqual(f.completions, []);
});
test("cancellation during onText cannot schedule another frame", () => {
  const frames = new Map(); let next = 0, complete = 0;
  const stream = new StreamingText({ boosted: true,
    requestFrame: (callback) => { frames.set(++next, callback); return next; },
    cancelFrame: (id) => frames.delete(id),
    onText: () => stream.cancel(), onComplete: () => { complete++; },
  });
  stream.append("large pending reply ".repeat(100));
  const callback = [...frames.values()][0]; frames.clear(); callback(0);
  assert.equal(frames.size, 0); assert.equal(complete, 0);
});
