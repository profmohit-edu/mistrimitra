/**
 * Microphone capture (16 kHz PCM16 for Gemini) and gap-free playback of
 * Gemini's PCM16 replies. The sample conversions are pure and unit-tested.
 * @module audio
 */
import { CHUNK_MS, INPUT_SAMPLE_RATE } from './config.js';

/**
 * Averages input samples down to the target rate.
 * @param {Float32Array} input
 * @param {number} inRate
 * @param {number} outRate
 */
export function downsample(input, inRate, outRate = INPUT_SAMPLE_RATE) {
  if (inRate === outRate) {
    return input;
  }
  const ratio = inRate / outRate;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += input[j];
    }
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

/** Float samples in [-1, 1] to little-endian 16-bit PCM bytes. @param {Float32Array} samples */
export function floatToPcm16(samples) {
  const view = new DataView(new ArrayBuffer(samples.length * 2));
  samples.forEach((v, i) => view.setInt16(i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
  return new Uint8Array(view.buffer);
}

/** Little-endian 16-bit PCM bytes to float samples. @param {Uint8Array} bytes */
export function pcm16ToFloat(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(Math.floor(bytes.byteLength / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = view.getInt16(i * 2, true) / 0x8000;
  }
  return out;
}

/** @param {Uint8Array} bytes */
export function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

/** @param {string} b64 */
export function fromBase64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Root-mean-square level of a frame. @param {Float32Array} samples */
export function rms(samples) {
  let sum = 0;
  for (const v of samples) {
    sum += v * v;
  }
  return Math.sqrt(sum / Math.max(1, samples.length));
}

/**
 * Captures the microphone and calls `onChunk(base64, level)` every CHUNK_MS.
 * @param {(base64: string, level: number) => void} onChunk
 */
export async function startMicrophone(onChunk) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const ctx = new AudioContext();
  await ctx.audioWorklet.addModule('worklet/recorder.js');
  const node = new AudioWorkletNode(ctx, 'mm-recorder');
  ctx.createMediaStreamSource(stream).connect(node);
  const frameTarget = (ctx.sampleRate * CHUNK_MS) / 1000;
  /** @type {Float32Array[]} */
  let frames = [];
  let length = 0;
  node.port.onmessage = (e) => {
    frames.push(e.data);
    length += e.data.length;
    if (length >= frameTarget) {
      const joined = new Float32Array(length);
      frames.reduce((offset, f) => (joined.set(f, offset), offset + f.length), 0);
      frames = [];
      length = 0;
      onChunk(toBase64(floatToPcm16(downsample(joined, ctx.sampleRate))), rms(joined));
    }
  };
  return () => {
    stream.getTracks().forEach((t) => t.stop());
    ctx.close();
  };
}

/** Plays queued PCM16 chunks back to back; `stop()` cuts playback on barge-in. */
export class Player {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    this.nextTime = 0;
    /** @type {Set<AudioBufferSourceNode>} */
    this.sources = new Set();
  }

  /** @param {string} base64 @param {number} rate */
  play(base64, rate) {
    this.ctx ??= new AudioContext();
    const samples = pcm16ToFloat(fromBase64(base64));
    const buffer = this.ctx.createBuffer(1, samples.length, rate);
    buffer.copyToChannel(samples, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);
    this.nextTime = Math.max(this.nextTime, this.ctx.currentTime);
    src.start(this.nextTime);
    this.nextTime += buffer.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  stop() {
    this.sources.forEach((s) => s.stop());
    this.sources.clear();
    this.nextTime = 0;
  }
}
