import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downsample, floatToPcm16, fromBase64, pcm16ToFloat, rms, toBase64 } from '../src/audio.js';
import { LatencyMeter, detectLanguage } from '../src/signals.js';
import { loadCmms, saveCmms } from '../src/store.js';
import { emptyCmms } from '../src/cmms.js';
import { isValidModel } from '../src/config.js';

test('downsampling 48 kHz to 16 kHz keeps a third of the samples', () => {
  const out = downsample(new Float32Array(480).fill(0.5), 48000);
  assert.equal(out.length, 160);
  assert.ok(Math.abs(out[10] - 0.5) < 1e-6);
  assert.equal(downsample(new Float32Array(10), 16000).length, 10);
});

test('PCM16 round trip and clipping', () => {
  const pcm = floatToPcm16(new Float32Array([0, 1, -1, 2]));
  const back = pcm16ToFloat(new Uint8Array(pcm.buffer));
  assert.ok(Math.abs(back[1] - 1) < 1e-3);
  assert.ok(Math.abs(back[2] + 1) < 1e-3);
  assert.ok(back[3] <= 1);
});

test('base64 round trip and rms', () => {
  const bytes = new Uint8Array([0, 1, 254, 255, 128]);
  assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
  assert.equal(rms(new Float32Array([0.5, -0.5])), 0.5);
  assert.equal(rms(new Float32Array(0)), 0);
});

test('latency is measured from end of speech to first reply chunk only', () => {
  const m = new LatencyMeter();
  m.level(0.1, 0);
  m.level(0.1, 1000);
  m.level(0, 1300);
  m.level(0, 1700);
  assert.equal(m.reply(2200), 1200);
  assert.equal(m.reply(2300), null);
  m.typed(5000);
  assert.equal(m.reply(5800), 800);
  assert.equal(new LatencyMeter().reply(1), null);
});

test('language detection', () => {
  assert.equal(detectLanguage('मशीन गरम हो रही है'), 'Hindi');
  assert.equal(detectLanguage('मशीन गरम आहे'), 'Marathi');
  assert.equal(detectLanguage('இயந்திரம்'), 'Tamil');
  assert.equal(detectLanguage('యంత్రం'), 'Telugu');
  assert.equal(detectLanguage('যন্ত্র'), 'Bengali');
  assert.equal(detectLanguage('alarm aa raha hai'), 'Hinglish');
  assert.equal(detectLanguage('the spindle trips'), 'English');
});

/** @returns {Storage} */
function memoryStore() {
  const m = new Map();
  return /** @type {any} */ ({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) });
}

test('CMMS state survives a save and load, and junk falls back to fresh', () => {
  const store = memoryStore();
  const s = emptyCmms();
  s.reserved['6205-2RS'] = 2;
  s.nextWorkOrder = 2540;
  saveCmms(s, store);
  assert.deepEqual(loadCmms(store), s);
  store.setItem('mistrimitra:cmms', '{bad json');
  assert.deepEqual(loadCmms(store), emptyCmms());
  store.setItem(
    'mistrimitra:cmms',
    JSON.stringify({ workOrders: [], alerts: [], drafts: [], reserved: { a: -1, b: 'x', c: 1 } }),
  );
  assert.deepEqual(loadCmms(store).reserved, { c: 1 });
  assert.deepEqual(loadCmms(null), emptyCmms());
});

test('model names are validated', () => {
  assert.ok(isValidModel('gemini-3.8-live'));
  assert.ok(!isValidModel('gpt'));
  assert.ok(!isValidModel('gemini-<script>'));
});
