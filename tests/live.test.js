import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LiveSession,
  audioMessage,
  buildSetup,
  parseServerMessage,
  rateFromMime,
  readFrame,
  textMessage,
} from '../src/live.js';

test('setup puts modalities, tools and transcription under setup', () => {
  const s = buildSetup({ systemInstruction: 'sys', tools: [{ name: 't' }] });
  assert.equal(s.setup.model, 'models/gemini-3.8-live');
  assert.deepEqual(s.setup.generationConfig.responseModalities, ['AUDIO']);
  assert.equal(s.setup.responseModalities, undefined);
  assert.deepEqual(s.setup.tools, [{ functionDeclarations: [{ name: 't' }] }]);
  assert.deepEqual(s.setup.inputAudioTranscription, {});
  assert.equal(s.setup.systemInstruction.parts[0].text, 'sys');
});

test('message builders', () => {
  assert.deepEqual(audioMessage('AA'), { realtimeInput: { audio: { data: 'AA', mimeType: 'audio/pcm;rate=16000' } } });
  assert.deepEqual(textMessage('hi'), { realtimeInput: { text: 'hi' } });
  assert.equal(rateFromMime('audio/pcm;rate=24000'), 24000);
  assert.equal(rateFromMime(undefined), 24000);
});

test('server messages become events', () => {
  const ev = parseServerMessage({
    serverContent: {
      inputTranscription: { text: 'alarm' },
      outputTranscription: { text: 'theek' },
      modelTurn: { parts: [{ inlineData: { data: 'QQ', mimeType: 'audio/pcm;rate=24000' } }, { text: 'x' }] },
      interrupted: true,
      turnComplete: true,
    },
  });
  assert.deepEqual(
    ev.map((e) => e.type),
    ['user-text', 'agent-text', 'audio', 'interrupted', 'turn-complete'],
  );
  assert.deepEqual(parseServerMessage({ setupComplete: {} }), [{ type: 'ready' }]);
  assert.equal(
    parseServerMessage({ toolCall: { functionCalls: [{ id: '1', name: 'a', args: {} }] } })[0].type,
    'tool-call',
  );
  assert.equal(parseServerMessage({ goAway: {} })[0].type, 'go-away');
  assert.deepEqual(parseServerMessage(null), []);
  assert.deepEqual(parseServerMessage({ unknown: 1 }), []);
});

test('frames can be strings or blobs', async () => {
  assert.deepEqual(await readFrame('{"a":1}'), { a: 1 });
  assert.deepEqual(await readFrame(new Blob(['{"b":2}'])), { b: 2 });
});

class FakeSocket {
  static last;
  constructor(url) {
    this.url = url;
    this.sent = [];
    this.readyState = 1;
    FakeSocket.last = this;
    setTimeout(() => this.onopen?.(), 0);
  }
  send(m) {
    this.sent.push(JSON.parse(m));
  }
  close() {
    this.closed = true;
  }
  /** @param {object} msg */
  receive(msg) {
    return this.onmessage?.({ data: JSON.stringify(msg) });
  }
}

test('session sends setup, answers tool calls and reports events', async () => {
  const events = [];
  const session = new LiveSession({
    apiKey: 'k&y',
    setup: { setup: { model: 'm' } },
    onEvent: (e) => events.push(e),
    runTool: (c) => ({ ok: c.name }),
    WebSocketImpl: /** @type {any} */ (FakeSocket),
  });
  const done = session.connect();
  await new Promise((r) => setTimeout(r, 0));
  const ws = FakeSocket.last;
  assert.match(ws.url, /key=k%26y$/);
  assert.deepEqual(ws.sent[0], { setup: { model: 'm' } });
  await ws.receive({ setupComplete: {} });
  await done;
  await ws.receive({ toolCall: { functionCalls: [{ id: 'c1', name: 'check_spare', args: {} }] } });
  assert.deepEqual(ws.sent[1], {
    toolResponse: { functionResponses: [{ id: 'c1', name: 'check_spare', response: { ok: 'check_spare' } }] },
  });
  assert.deepEqual(events.at(-1).results, [{ ok: 'check_spare' }]);
  session.send(textMessage('hi'));
  assert.deepEqual(ws.sent[2], { realtimeInput: { text: 'hi' } });
  session.close();
  assert.ok(ws.closed);
  session.send(textMessage('ignored'));
  assert.equal(ws.sent.length, 3);
});

test('connect rejects when the socket errors', async () => {
  const session = new LiveSession({
    apiKey: 'k',
    setup: {},
    onEvent: () => {},
    runTool: () => ({}),
    WebSocketImpl: /** @type {any} */ (FakeSocket),
  });
  const done = session.connect();
  FakeSocket.last.onerror();
  await assert.rejects(done, /Could not reach Gemini/);
  session.close();
});

test('connect rejects with the reason when Gemini closes the session during setup', async () => {
  const events = [];
  const session = new LiveSession({
    apiKey: 'k',
    setup: {},
    onEvent: (e) => events.push(e),
    runTool: () => ({}),
    WebSocketImpl: /** @type {any} */ (FakeSocket),
  });
  const done = session.connect();
  FakeSocket.last.onclose({ code: 1007, reason: 'Invalid JSON payload' });
  await assert.rejects(done, /Gemini closed the session: Invalid JSON payload/);
  assert.deepEqual(events, []);
});

test('a close after setup is reported as an event', async () => {
  const events = [];
  const session = new LiveSession({
    apiKey: 'k',
    setup: {},
    onEvent: (e) => events.push(e),
    runTool: () => ({}),
    WebSocketImpl: /** @type {any} */ (FakeSocket),
  });
  const done = session.connect();
  await FakeSocket.last.receive({ setupComplete: {} });
  await done;
  FakeSocket.last.onclose({ code: 1000, reason: '' });
  assert.deepEqual(events.at(-1), { type: 'error', message: 'Session ended.' });
});
