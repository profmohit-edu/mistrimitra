/**
 * Persistence: the mock CMMS in localStorage and the API key in
 * sessionStorage (localStorage only if the user asks). Every read is
 * validated; broken or blocked storage falls back to defaults.
 * @module store
 */
import { emptyCmms } from './cmms.js';
import { LIVE_MODEL, isValidModel } from './config.js';

const KEY_CMMS = 'mistrimitra:cmms';
const KEY_API = 'mistrimitra:key';
const KEY_MODEL = 'mistrimitra:model';

/** @param {'localStorage'|'sessionStorage'} kind @returns {Storage | null} */
function storage(kind) {
  try {
    return globalThis[kind] ?? null;
  } catch {
    return null;
  }
}

/** @param {unknown} v @returns {v is any[]} */
const isArray = (v) => Array.isArray(v);

/** @param {any} saved */
const looksValid = (saved) =>
  Boolean(saved) && isArray(saved.workOrders) && isArray(saved.alerts) && isArray(saved.drafts);

/** Keeps only whole, non-negative reservation counts. @param {unknown} reserved */
const cleanReserved = (reserved) =>
  Object.fromEntries(Object.entries(reserved ?? {}).filter(([, n]) => Number.isInteger(n) && Number(n) >= 0));

/**
 * Loads the CMMS state, or a fresh one if nothing valid is saved.
 * @param {Storage | null} [store]
 * @returns {import('./cmms.js').CmmsState}
 */
export function loadCmms(store = storage('localStorage')) {
  const fresh = emptyCmms();
  try {
    const saved = JSON.parse(store?.getItem(KEY_CMMS) ?? 'null');
    if (!looksValid(saved)) {
      return fresh;
    }
    const next = Number.isInteger(saved.nextWorkOrder) ? saved.nextWorkOrder : fresh.nextWorkOrder;
    return {
      workOrders: saved.workOrders,
      alerts: saved.alerts,
      drafts: saved.drafts,
      reserved: cleanReserved(saved.reserved),
      nextWorkOrder: next,
    };
  } catch {
    return fresh;
  }
}

/** @param {import('./cmms.js').CmmsState} cmms @param {Storage | null} [store] */
export function saveCmms(cmms, store = storage('localStorage')) {
  try {
    store?.setItem(KEY_CMMS, JSON.stringify(cmms));
  } catch {
    // Storage full or blocked: the session still works, it just is not saved.
  }
}

/** @returns {{apiKey: string, model: string, remember: boolean}} */
export function loadSettings() {
  const local = storage('localStorage');
  const remembered = local?.getItem(KEY_API) ?? '';
  const apiKey = storage('sessionStorage')?.getItem(KEY_API) || remembered;
  const model = local?.getItem(KEY_MODEL) ?? '';
  return { apiKey, model: isValidModel(model) ? model : LIVE_MODEL, remember: Boolean(remembered) };
}

/** @param {{apiKey: string, model: string, remember: boolean}} s */
export function saveSettings({ apiKey, model, remember }) {
  const local = storage('localStorage');
  const session = storage('sessionStorage');
  const key = apiKey.trim();
  session?.setItem(KEY_API, key);
  if (remember && key) {
    local?.setItem(KEY_API, key);
  } else {
    local?.removeItem(KEY_API);
  }
  local?.setItem(KEY_MODEL, isValidModel(model) ? model : LIVE_MODEL);
}
