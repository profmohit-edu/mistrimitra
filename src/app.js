/**
 * Entry point: builds the controller and wires the page controls.
 * @module app
 */
import { newAgentState } from './agent.js';
import { emptyCmms } from './cmms.js';
import { Player } from './audio.js';
import { LatencyMeter } from './signals.js';
import { DEMO_SCRIPT } from './script.js';
import { buttonById, byId, dialogById, errorMessage, h, inputById } from './dom.js';
import { SUGGESTIONS, renderAll, say, setStatus } from './ui.js';
import { loadCmms, loadSettings, saveCmms, saveSettings } from './store.js';
import { runAndShow, sendTyped, startLive, stopLive, userSpoke } from './session.js';

const PAUSE_MS = 900;

/** @type {import('./session.js').Controller} */
const c = {
  state: newAgentState(loadCmms()),
  live: null,
  stopMic: null,
  player: new Player(),
  latency: new LatencyMeter(),
  lastSpeaker: null,
};

const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

/** Opens settings when no key is saved; returns the settings otherwise. */
function settingsOrPrompt() {
  const s = loadSettings();
  if (!s.apiKey) {
    openSettings();
    setStatus('Add your Gemini API key to talk live, or run the scripted demo.');
    return null;
  }
  return s;
}

/** @param {boolean} textOnly */
async function ensureLive(textOnly) {
  const s = settingsOrPrompt();
  if (!s || c.live) {
    return Boolean(c.live);
  }
  try {
    await startLive(c, { apiKey: s.apiKey, model: s.model, textOnly });
    return true;
  } catch (e) {
    stopLive(c);
    setStatus(errorMessage(e));
    return false;
  }
}

async function onTalk() {
  const btn = buttonById('talk');
  if (c.live) {
    stopLive(c);
  } else if (await ensureLive(false)) {
    btn.textContent = 'Stop';
    btn.setAttribute('aria-pressed', 'true');
    return;
  }
  btn.textContent = 'Start talking';
  btn.setAttribute('aria-pressed', 'false');
}

/** @param {string} text */
async function onTyped(text) {
  const clean = text.trim();
  if (clean && (await ensureLive(true))) {
    sendTyped(c, clean);
  }
}

/** Plays the scripted walkthrough; every tool call runs for real. */
async function runDemo() {
  const btn = buttonById('demo');
  btn.disabled = true;
  setStatus('Scripted demo: the lines are pre-written, the tools and safety rules are real.');
  for (const step of DEMO_SCRIPT) {
    userSpoke(c);
    say('user', step.user, { scripted: true });
    await sleep(PAUSE_MS);
    const results = step.tools.map((call) => runAndShow(c, call));
    c.lastSpeaker = 'agent';
    say('agent', step.reply(results), { scripted: true });
    await sleep(PAUSE_MS * 2);
  }
  setStatus('Demo finished. Add a Gemini key to talk live.');
  btn.disabled = false;
}

function openSettings() {
  const s = loadSettings();
  inputById('api-key').value = s.apiKey;
  inputById('model').value = s.model;
  inputById('remember-key').checked = s.remember;
  dialogById('settings').showModal();
}

function wire() {
  buttonById('talk').addEventListener('click', onTalk);
  buttonById('demo').addEventListener('click', runDemo);
  buttonById('open-settings').addEventListener('click', openSettings);
  buttonById('reset').addEventListener('click', () => {
    c.state = newAgentState(emptyCmms());
    saveCmms(c.state.cmms);
    renderAll(c.state);
    setStatus('Plant data reset.');
  });
  byId('type-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = inputById('type-input');
    onTyped(input.value);
    input.value = '';
  });
  dialogById('settings').addEventListener('close', () => {
    if (dialogById('settings').returnValue === 'save') {
      saveSettings({
        apiKey: inputById('api-key').value,
        model: inputById('model').value,
        remember: inputById('remember-key').checked,
      });
      setStatus('Saved. Press Start talking, or type below.');
    }
  });
  byId('suggestions').append(
    ...SUGGESTIONS.map((s) => {
      const b = h('button', { type: 'button', class: 'btn chip-btn' }, s);
      b.addEventListener('click', () => onTyped(s));
      return b;
    }),
  );
}

wire();
renderAll(c.state);
