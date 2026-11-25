/**
 * Connects the Live API session to the agent, the microphone, playback and
 * the screen.
 * @module session
 */
import { LiveSession, buildSetup, textMessage, audioMessage } from './live.js';
import { SYSTEM_INSTRUCTION, TOOL_DECLARATIONS, runTool } from './agent.js';
import { startMicrophone } from './audio.js';
import { detectLanguage } from './signals.js';
import { renderAll, say, setStatus } from './ui.js';
import { saveCmms } from './store.js';
import { byId } from './dom.js';

/**
 * @typedef {object} Controller
 * @property {import('./agent.js').AgentState} state
 * @property {LiveSession | null} live
 * @property {(() => void) | null} stopMic
 * @property {import('./audio.js').Player} player
 * @property {import('./signals.js').LatencyMeter} latency
 * @property {'user'|'agent'|null} lastSpeaker
 */

/**
 * Runs a tool call, shows it on screen and saves the CMMS.
 * @param {Controller} c
 * @param {{name: string, args?: object}} call
 */
export function runAndShow(c, call) {
  const result = runTool(c.state, call);
  say('tool', `${call.name}${'error' in result ? ` → ${result.error}` : ''}`);
  renderAll(c.state);
  saveCmms(c.state.cmms);
  return result;
}

/** Counts a new technician turn (used by the confirmation rule). @param {Controller} c */
export function userSpoke(c) {
  if (c.lastSpeaker !== 'user') {
    c.state.userTurn += 1;
  }
  c.lastSpeaker = 'user';
}

/**
 * @param {Controller} c
 * @param {import('./live.js').LiveEvent} e
 */
export function onLiveEvent(c, e) {
  if (e.type === 'user-text') {
    userSpoke(c);
    say('user', e.text);
    byId('lang-chip').textContent = `Language: ${detectLanguage(e.text)}`;
  } else if (e.type === 'agent-text') {
    c.lastSpeaker = 'agent';
    say('agent', e.text);
  } else if (e.type === 'audio') {
    showLatency(c.latency.reply(performance.now()));
    c.player.play(e.data, e.rate);
  } else if (e.type === 'interrupted') {
    c.player.stop();
    setStatus('You interrupted, listening…');
  } else if (e.type === 'error' || e.type === 'go-away') {
    setStatus(e.type === 'error' ? e.message : 'Session is ending, reconnect to continue.');
  }
}

/** @param {number | null} ms */
function showLatency(ms) {
  if (ms !== null) {
    byId('latency-chip').textContent = `Response time: ${(ms / 1000).toFixed(1)} s`;
  }
}

/**
 * Starts a live session (and the microphone unless `textOnly`).
 * @param {Controller} c
 * @param {{apiKey: string, model: string, textOnly?: boolean}} o
 */
export async function startLive(c, { apiKey, model, textOnly = false }) {
  setStatus('Connecting to Gemini 3.8 Live…');
  const setup = buildSetup({ model, systemInstruction: SYSTEM_INSTRUCTION, tools: TOOL_DECLARATIONS });
  c.live = new LiveSession({
    apiKey,
    setup,
    onEvent: (e) => onLiveEvent(c, e),
    runTool: (call) => runAndShow(c, call),
    WebSocketImpl: globalThis.WebSocket,
  });
  await c.live.connect();
  setStatus(textOnly ? 'Connected. Type below.' : 'Listening. Speak naturally; you can interrupt any time.');
  if (!textOnly) {
    c.stopMic = await startMicrophone((b64, level) => {
      c.live?.send(audioMessage(b64));
      c.latency.level(level, performance.now());
      byId('meter-bar').style.width = `${Math.min(100, Math.round(level * 400))}%`;
    });
  }
}

/** @param {Controller} c */
export function stopLive(c) {
  c.stopMic?.();
  c.stopMic = null;
  c.live?.close();
  c.live = null;
  c.player.stop();
  byId('meter-bar').style.width = '0%';
  setStatus('Session ended.');
}

/**
 * Sends a typed message in the live session.
 * @param {Controller} c
 * @param {string} text
 */
export function sendTyped(c, text) {
  userSpoke(c);
  say('user', text);
  byId('lang-chip').textContent = `Language: ${detectLanguage(text)}`;
  c.latency.typed(performance.now());
  c.live?.send(textMessage(text));
}
