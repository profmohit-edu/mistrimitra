/**
 * Renders the agent's state: transcript, safety gate, sources, actions,
 * spares and captured know-how. Every string goes into a text node.
 * @module ui
 */
import { MACHINES, INVENTORY } from './data/plant.js';
import { byId, h, mount } from './dom.js';

/** Example requests a technician might say. */
export const SUGGESTIONS = [
  'Line 3 CNC pe alarm 1014 aa raha hai, spindle do baar trip hua.',
  'LOTO ho gaya hai, ab bearing kaise check karun?',
  'Press L1-02 ka tel garam ho raha hai, H21 aa raha hai.',
  'Bearing 6205 store mein hai kya?',
];

/**
 * Adds or extends a transcript bubble. Consecutive text from the same speaker
 * is merged, as the Live API streams transcripts in fragments.
 * @param {'user'|'agent'|'tool'|'note'} who
 * @param {string} text
 * @param {{scripted?: boolean}} [opts]
 */
export function say(who, text, { scripted = false } = {}) {
  const log = byId('transcript');
  if (appendToLast(log, who, text)) {
    return;
  }
  const labels = { user: 'Technician', agent: 'MistriMitra', tool: 'Tool', note: 'Note' };
  const label = h('span', { class: 'who' }, labels[who], scripted && ' · scripted');
  const item = h('li', { class: `msg ${who}`, 'data-who': who }, label, h('span', { class: 'text' }, text));
  log.append(item);
  item.scrollIntoView({ block: 'nearest' });
}

/**
 * Streams more text into the last bubble when the same person is still talking.
 * @param {HTMLElement} log
 * @param {string} who
 * @param {string} text
 */
function appendToLast(log, who, text) {
  const last = /** @type {HTMLElement | null} */ (log.lastElementChild);
  const body = last?.dataset.who === who && (who === 'user' || who === 'agent') ? last.querySelector('.text') : null;
  if (body) {
    body.textContent += text;
  }
  return Boolean(body);
}

/** @param {import('./agent.js').AgentState} state */
export function renderSafety(state) {
  mount(
    byId('safety'),
    MACHINES.map((m) =>
      h(
        'li',
        { class: state.loto.has(m.id) ? 'ok' : 'warn' },
        h('strong', {}, m.id),
        ` ${m.name}: `,
        state.loto.has(m.id)
          ? 'lockout/tagout confirmed, repair steps unlocked'
          : 'repair steps locked until LOTO is confirmed',
      ),
    ),
  );
}

/** @param {import('./agent.js').AgentState} state */
export function renderSources(state) {
  const items = state.lastSources.map((s) =>
    h(
      'li',
      { class: s.withheld ? 'warn' : '' },
      h('strong', {}, s.id),
      ` · ${s.title}`,
      s.withheld && h('span', { class: 'tag' }, 'withheld until LOTO'),
    ),
  );
  mount(
    byId('sources'),
    items.length ? items : h('li', { class: 'muted' }, 'Sources appear here when the agent searches.'),
  );
}

/** @param {import('./cmms.js').CmmsState} cmms */
export function renderActions(cmms) {
  const orders = cmms.workOrders.map((w) =>
    h(
      'li',
      { class: 'ok' },
      h('strong', {}, w.id),
      ` ${w.machineId} · ${w.problem} · ${w.priority}`,
      w.partNumber && ` · ${w.quantity} x ${w.partNumber} reserved`,
    ),
  );
  const alerts = cmms.alerts.map((a) =>
    h('li', {}, h('strong', {}, `Alert to ${a.to}`), ` (${a.channel}): ${a.message}`),
  );
  const items = [...orders, ...alerts];
  mount(
    byId('actions'),
    items.length
      ? items
      : h('li', { class: 'muted' }, 'Nothing yet. Actions run only after a spoken read-back and your yes.'),
  );
}

/** @param {import('./cmms.js').CmmsState} cmms */
export function renderSpares(cmms) {
  mount(
    byId('spares'),
    INVENTORY.map((p) => {
      const free = p.onHand - (cmms.reserved[p.partNumber] ?? 0);
      return h(
        'tr',
        { class: free <= p.reorderLevel ? 'low' : '' },
        h('td', {}, h('strong', {}, p.partNumber), h('br'), p.name),
        h('td', {}, p.store),
        h('td', {}, String(free)),
      );
    }),
  );
}

/** @param {import('./cmms.js').CmmsState} cmms */
export function renderDrafts(cmms) {
  const items = cmms.drafts.map((d) =>
    h(
      'li',
      {},
      h('strong', {}, d.id),
      ` ${d.machineId}: ${d.symptom} → ${d.fix}`,
      h('span', { class: 'tag' }, d.status),
    ),
  );
  mount(
    byId('drafts'),
    items.length
      ? items
      : h('li', { class: 'muted' }, 'After a fix, MistriMitra asks "kya kiya?" and saves the answer here.'),
  );
}

/** @param {import('./agent.js').AgentState} state */
export function renderAll(state) {
  renderSafety(state);
  renderSources(state);
  renderActions(state.cmms);
  renderSpares(state.cmms);
  renderDrafts(state.cmms);
}

/** @param {string} text */
export const setStatus = (text) => {
  byId('status').textContent = text;
};
