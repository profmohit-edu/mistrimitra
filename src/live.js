/**
 * Gemini Live API client over a raw WebSocket. Message building and parsing
 * are pure functions so they can be tested without a network.
 * @module live
 */
import { CONNECT_TIMEOUT_MS, LIVE_ENDPOINT, LIVE_MODEL, OUTPUT_SAMPLE_RATE, VOICE_NAME } from './config.js';

/**
 * The first message of a session.
 * @param {{model?: string, systemInstruction: string, tools: object[], voice?: string}} o
 */
export function buildSetup({ model = LIVE_MODEL, systemInstruction, tools, voice = VOICE_NAME }) {
  return {
    setup: {
      model: `models/${model}`,
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      systemInstruction: { parts: [{ text: systemInstruction }] },
      tools: [{ functionDeclarations: tools }],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      contextWindowCompression: { slidingWindow: {} },
      sessionResumption: {},
    },
  };
}

/** @param {string} base64 PCM16 at 16 kHz */
export const audioMessage = (base64) => ({
  realtimeInput: { audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } },
});
/** @param {string} text */
export const textMessage = (text) => ({ realtimeInput: { text } });
/** @param {Array<{id: string, name: string, response: object}>} responses */
export const toolResponseMessage = (responses) => ({ toolResponse: { functionResponses: responses } });

/** Reads the sample rate from a mime type such as "audio/pcm;rate=24000". @param {string} [mime] */
export function rateFromMime(mime) {
  const m = /rate=(\d+)/.exec(mime ?? '');
  return m ? Number(m[1]) : OUTPUT_SAMPLE_RATE;
}

/**
 * @typedef {{type: 'ready'} | {type: 'user-text', text: string} | {type: 'agent-text', text: string}
 *  | {type: 'audio', data: string, rate: number} | {type: 'interrupted'} | {type: 'turn-complete'}
 *  | {type: 'tool-call', calls: Array<{id: string, name: string, args: object}>, results?: object[]} | {type: 'go-away'} | {type: 'error', message: string}} LiveEvent
 */

/**
 * Turns one server message into zero or more events.
 * @param {any} msg
 * @returns {LiveEvent[]}
 */
export function parseServerMessage(msg) {
  if (!msg || typeof msg !== 'object') {
    return [];
  }
  if (msg.serverContent) {
    return contentEvents(msg.serverContent);
  }
  const rule = TOP_LEVEL.find(([key]) => msg[key]);
  return rule ? [rule[1](msg[rule[0]])] : [];
}

/** Top-level server messages other than serverContent. @type {Array<[string, (v: any) => LiveEvent]>} */
const TOP_LEVEL = [
  ['setupComplete', () => ({ type: 'ready' })],
  ['toolCall', (v) => ({ type: 'tool-call', calls: v.functionCalls ?? [] })],
  ['goAway', () => ({ type: 'go-away' })],
  ['error', (v) => ({ type: 'error', message: String(v.message ?? v) })],
];

/** @param {any} c @returns {LiveEvent[]} */
function contentEvents(c) {
  /** @type {LiveEvent[]} */
  const flags = [];
  if (c.interrupted) {
    flags.push({ type: 'interrupted' });
  }
  if (c.turnComplete) {
    flags.push({ type: 'turn-complete' });
  }
  return [...transcriptEvents(c), ...audioEvents(c), ...flags];
}

/** @param {any} c @returns {LiveEvent[]} */
function transcriptEvents(c) {
  /** @type {LiveEvent[]} */
  const out = [];
  if (c.inputTranscription?.text) {
    out.push({ type: 'user-text', text: c.inputTranscription.text });
  }
  if (c.outputTranscription?.text) {
    out.push({ type: 'agent-text', text: c.outputTranscription.text });
  }
  return out;
}

/** @param {any} c @returns {LiveEvent[]} */
function audioEvents(c) {
  const parts = c.modelTurn?.parts ?? [];
  return parts
    .filter((p) => p.inlineData?.data)
    .map((p) => ({ type: 'audio', data: p.inlineData.data, rate: rateFromMime(p.inlineData.mimeType) }));
}

/** Reads a WebSocket message body, which may be a string or a Blob. @param {any} data */
export async function readFrame(data) {
  const text = typeof data === 'string' ? data : await data.text();
  return JSON.parse(text);
}

/**
 * One live conversation. Events are delivered to `onEvent`; tool calls are
 * answered with the results of `runTool`.
 */
export class LiveSession {
  /**
   * @param {{apiKey: string, setup: object, onEvent: (e: LiveEvent) => void,
   *   runTool: (call: {name: string, args?: object}) => object, WebSocketImpl?: typeof WebSocket}} o
   */
  constructor({ apiKey, setup, onEvent, runTool, WebSocketImpl = WebSocket }) {
    this.url = `${LIVE_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
    this.setup = setup;
    this.onEvent = onEvent;
    this.runTool = runTool;
    this.WebSocketImpl = WebSocketImpl;
    /** @type {WebSocket | null} */
    this.ws = null;
  }

  /** Opens the socket and resolves once Gemini has accepted the setup. */
  connect() {
    return new Promise((resolve, reject) => {
      const ws = new this.WebSocketImpl(this.url);
      this.ws = ws;
      const timer = setTimeout(() => reject(new Error('Gemini did not answer in time.')), CONNECT_TIMEOUT_MS);
      ws.onopen = () => ws.send(JSON.stringify(this.setup));
      ws.onerror = () => reject(new Error('Could not reach Gemini. Check the API key and your connection.'));
      ws.onclose = (e) => this.onEvent({ type: 'error', message: e.reason || 'Session ended.' });
      ws.onmessage = async (m) => {
        const events = parseServerMessage(await readFrame(m.data));
        if (events.some((e) => e.type === 'ready')) {
          clearTimeout(timer);
          resolve(undefined);
        }
        events.forEach((e) => this.handle(e));
      };
    });
  }

  /** @param {LiveEvent} e */
  handle(e) {
    if (e.type === 'tool-call') {
      const responses = e.calls.map((c) => ({ id: c.id, name: c.name, response: this.runTool(c) }));
      this.send(toolResponseMessage(responses));
      this.onEvent({ ...e, results: responses.map((r) => r.response) });
      return;
    }
    this.onEvent(e);
  }

  /** @param {object} message */
  send(message) {
    if (this.ws?.readyState === 1) {
      this.ws.send(JSON.stringify(message));
    }
  }

  close() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this.ws = null;
  }
}
