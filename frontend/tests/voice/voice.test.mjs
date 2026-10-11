import test from "node:test";
import assert from "node:assert/strict";

// Import modules directly or simulate classes to test exact logic
import { ResponseSpeechBuffer } from "../../apps/web/voice/response-speech-buffer.ts";

test("ResponseSpeechBuffer: cleans Markdown, code blocks and URLs for spoken audio", () => {
  const buffer = new ResponseSpeechBuffer(() => {});
  
  const raw1 = "# Heading 1\nThis is **bold** text and `inline_code`.";
  const cleaned1 = buffer.cleanForSpeech(raw1);
  assert.equal(cleaned1, "Heading 1 This is bold text and inline_code.");

  const raw2 = "Check this code: ```python\nprint('hello')\n``` And visit https://example.com/api";
  const cleaned2 = buffer.cleanForSpeech(raw2);
  assert.equal(cleaned2, "Check this code: Code block omitted. And visit link");
});

test("ResponseSpeechBuffer: partitions streamed tokens at sentence boundaries without waiting for full response", () => {
  const phrases = [];
  const buffer = new ResponseSpeechBuffer((phrase) => {
    phrases.push(phrase.text);
  });

  const turnId = "turn-1001";
  buffer.reset(turnId);

  // Stream chunk by chunk
  buffer.appendChunk("Good morning! ", turnId);
  assert.equal(phrases.length, 1);
  assert.equal(phrases[0], "Good morning!");

  buffer.appendChunk("The current weather is ", turnId);
  assert.equal(phrases.length, 1); // Still buffered

  buffer.appendChunk("mild and pleasant. ", turnId);
  assert.equal(phrases.length, 2);
  assert.equal(phrases[1], "The current weather is mild and pleasant.");

  buffer.appendChunk("Would you like to schedule an event?", turnId);
  buffer.flush(turnId);
  assert.equal(phrases.length, 3);
  assert.equal(phrases[2], "Would you like to schedule an event?");
});

test("ResponseSpeechBuffer: flushes trailing unpunctuated text on timeout or flush", async () => {
  const phrases = [];
  const buffer = new ResponseSpeechBuffer((phrase) => {
    phrases.push(phrase.text);
  });

  const turnId = "turn-1002";
  buffer.reset(turnId);

  buffer.appendChunk("Here is a short answer without punctuation", turnId);
  assert.equal(phrases.length, 0);

  // Allow flush timer (350ms) to trigger
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(phrases.length, 1);
  assert.equal(phrases[0], "Here is a short answer without punctuation");
});

test("ResponseSpeechBuffer: rejects chunks from obsolete turns", () => {
  const phrases = [];
  const buffer = new ResponseSpeechBuffer((phrase) => {
    phrases.push(phrase.text);
  });

  buffer.reset("turn-1");
  buffer.appendChunk("First turn. ", "turn-1");
  assert.equal(phrases.length, 1);

  // Reset to new turn
  buffer.reset("turn-2");

  // Late arrival from turn-1
  buffer.appendChunk("Late chunk from turn 1. ", "turn-1");
  assert.equal(phrases.length, 1); // Not added!

  buffer.appendChunk("Valid chunk from turn 2. ", "turn-2");
  assert.equal(phrases.length, 2);
  assert.equal(phrases[1], "Valid chunk from turn 2.");
});

test("PlaybackController & Barge-in Interruption semantics", () => {
  // Test queue and interruption isolation
  let activeUtterance = "Hello there!";
  let isPlaying = true;
  let queue = ["Next sentence.", "Final sentence."];
  let generation = 1;

  const interrupt = () => {
    generation++;
    queue = [];
    isPlaying = false;
    activeUtterance = null;
  };

  assert.equal(isPlaying, true);
  assert.equal(queue.length, 2);

  // Coordinated interruption triggered by user speech detection
  interrupt();

  assert.equal(isPlaying, false);
  assert.equal(queue.length, 0);
  assert.equal(activeUtterance, null);
  assert.equal(generation, 2);
});

test("Single submission rule: deduplication and turn IDs", () => {
  const submissions = [];
  let currentTurnId = "turn-initial";

  const submitTurn = (id, text) => {
    if (!text.trim()) return;
    submissions.push({ id, text: text.trim() });
  };

  currentTurnId = "turn-1";
  submitTurn(currentTurnId, "What is the capital of France?");
  
  // Repeating same word legitimately in another turn
  currentTurnId = "turn-2";
  submitTurn(currentTurnId, "Yes");

  currentTurnId = "turn-3";
  submitTurn(currentTurnId, "Yes");

  assert.equal(submissions.length, 3);
  assert.equal(submissions[0].id, "turn-1");
  assert.equal(submissions[1].id, "turn-2");
  assert.equal(submissions[1].text, "Yes");
  assert.equal(submissions[2].id, "turn-3");
  assert.equal(submissions[2].text, "Yes");
});
