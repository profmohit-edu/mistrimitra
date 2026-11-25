/**
 * Multi-source knowledge search (manuals, SOPs, past tickets, shift chats)
 * with BM25 ranking, a small Hinglish-to-English vocabulary for
 * cross-language queries, and a safety gate that withholds hands-on repair
 * steps until lockout/tagout is confirmed for the machine.
 * @module knowledge
 */
import { MACHINES, PASSAGES } from './data/plant.js';
import { SEARCH_TOP_K } from './config.js';

/** Common shop-floor Hindi/Hinglish words mapped to the English used in manuals. */
export const HINGLISH = {
  awaaz: 'noise',
  aawaz: 'noise',
  ghis: 'grinding',
  garam: 'overheat temperature',
  tel: 'oil',
  patta: 'belt',
  belt: 'belt',
  kampan: 'vibration',
  hil: 'vibration',
  dabav: 'pressure',
  pani: 'coolant',
  thanda: 'coolant',
  band: 'stop trip',
  trip: 'trip alarm',
  rukna: 'stop',
  bearing: 'bearing',
  tel_kam: 'oil low',
  check: 'check inspection',
  badal: 'replace replacement change',
  badalna: 'replace replacement change',
  badla: 'replace replacement change',
  dheela: 'loose tension slipping',
  kam: 'low',
  pichhli: 'previous history',
  pichli: 'previous history',
  history: 'history previous closed',
};

const STOPWORDS = new Set(
  'a an the is are was of to in on at for and or with it this that be by from pe ka ki ke hai ho raha rahi kya'.split(
    ' ',
  ),
);
const K1 = 1.4;
const B = 0.75;

/**
 * Lower-cases, splits on non-word characters (keeping part numbers such as
 * 6205-2rs), drops stop words and expands Hinglish words.
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  const raw =
    String(text)
      .toLowerCase()
      .match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];
  return raw.filter((t) => !STOPWORDS.has(t)).flatMap((t) => [t, ...expand(t)]);
}

/** @param {string} token */
function expand(token) {
  const english = Object.hasOwn(HINGLISH, token) ? HINGLISH[/** @type {keyof typeof HINGLISH} */ (token)] : '';
  const parts = token.includes('-') ? token.split('-') : [];
  return [...english.split(' ').filter(Boolean), ...parts];
}

/** Machine id plus its name and model, so "compressor" or "press" finds the right machine. @param {string} id */
function machineWords(id) {
  const m = MACHINES.find((x) => x.id === id);
  return m ? `${id} ${m.name} ${m.model}` : id;
}

/**
 * Builds a BM25 index over passages.
 * @param {import('./data/plant.js').Passage[]} passages
 */
export function buildIndex(passages) {
  const docs = passages.map((p) => ({
    passage: p,
    terms: tokenize(`${p.title} ${p.text} ${machineWords(p.machineId)}`),
  }));
  const df = new Map();
  for (const d of docs) {
    for (const t of new Set(d.terms)) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }
  const avgLen = docs.reduce((s, d) => s + d.terms.length, 0) / Math.max(1, docs.length);
  return { docs, df, avgLen, n: docs.length };
}

/**
 * BM25 score of one document for the query terms.
 * @param {ReturnType<typeof buildIndex>} index
 * @param {{terms: string[]}} doc
 * @param {string[]} queryTerms
 */
function score(index, doc, queryTerms) {
  let s = 0;
  for (const q of new Set(queryTerms)) {
    const tf = doc.terms.filter((t) => t === q).length;
    if (tf) {
      const df = index.df.get(q) ?? 0;
      const idf = Math.log(1 + (index.n - df + 0.5) / (df + 0.5));
      s += idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * doc.terms.length) / index.avgLen)));
    }
  }
  return s;
}

const DEFAULT_INDEX = buildIndex(PASSAGES);

/** Official sources rank above informal ones when the words match equally well. */
export const AUTHORITY = { manual: 1.3, sop: 1.3, ticket: 1.1, chat: 0.6 };

/**
 * @typedef {object} SearchHit
 * @property {string} id citation id
 * @property {string} kind
 * @property {string} machineId
 * @property {string} title
 * @property {string} text passage text, or a safety note when withheld
 * @property {boolean} withheld true when repair steps are hidden until LOTO
 * @property {number} score
 */

/**
 * Searches all sources. Repair steps for a machine are withheld until its
 * lockout/tagout is confirmed.
 * @param {string} query
 * @param {{machineId?: string, lotoConfirmed?: Set<string>, index?: ReturnType<typeof buildIndex>, topK?: number}} [opts]
 * @returns {SearchHit[]}
 */
export function searchKnowledge(
  query,
  { machineId, lotoConfirmed = new Set(), index = DEFAULT_INDEX, topK = SEARCH_TOP_K } = {},
) {
  const terms = tokenize(`${query} ${machineId ?? ''}`);
  return index.docs
    .filter((d) => !machineId || d.passage.machineId === machineId || d.passage.machineId === '*')
    .map((d) => ({ d, s: score(index, d, terms) * (AUTHORITY[d.passage.kind] ?? 1) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, topK)
    .map(({ d, s }) => toHit(d.passage, s, lotoConfirmed));
}

/**
 * @param {import('./data/plant.js').Passage} p
 * @param {number} s
 * @param {Set<string>} lotoConfirmed
 * @returns {SearchHit}
 */
function toHit(p, s, lotoConfirmed) {
  const withheld = Boolean(p.requiresLoto) && !lotoConfirmed.has(p.machineId);
  const text = withheld
    ? `Repair steps withheld: lockout/tagout is not yet confirmed for ${p.machineId}. Ask the technician to complete SOP-SAF-01 and confirm.`
    : p.text;
  return {
    id: p.id,
    kind: p.kind,
    machineId: p.machineId,
    title: p.title,
    text,
    withheld,
    score: Number(s.toFixed(3)),
  };
}
