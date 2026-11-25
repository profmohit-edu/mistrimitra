/**
 * A small mock CMMS (maintenance system): work orders, spare reservations,
 * supervisor alerts and knowledge drafts. State is a plain object so it can be
 * tested without a browser and saved to localStorage.
 * @module cmms
 */
import { INVENTORY, SUPERVISOR } from './data/plant.js';
import { FIRST_WORK_ORDER, MAX_FIELD_CHARS } from './config.js';

/**
 * @typedef {object} WorkOrder
 * @property {string} id
 * @property {string} machineId
 * @property {string} problem
 * @property {'low'|'medium'|'high'} priority
 * @property {string} [partNumber]
 * @property {number} [quantity]
 * @property {string} status
 * @property {string} createdAt ISO time
 */

/**
 * @typedef {object} CmmsState
 * @property {WorkOrder[]} workOrders
 * @property {Record<string, number>} reserved part number -> quantity reserved
 * @property {Array<{to: string, channel: string, machineId: string, message: string, priority: string, at: string}>} alerts
 * @property {Array<{id: string, machineId: string, symptom: string, cause: string, fix: string, parts: string, status: string}>} drafts
 * @property {number} nextWorkOrder
 */

/** @returns {CmmsState} */
export function emptyCmms() {
  return { workOrders: [], reserved: {}, alerts: [], drafts: [], nextWorkOrder: FIRST_WORK_ORDER };
}

/** Trims and caps free text from the model or the user. @param {unknown} v */
export const clean = (v) =>
  String(v ?? '')
    .trim()
    .slice(0, MAX_FIELD_CHARS);

/**
 * Finds spares whose part number or name matches the query.
 * @param {CmmsState} state
 * @param {string} query
 */
export function findSpares(state, query) {
  const q = clean(query).toLowerCase();
  return INVENTORY.filter(
    (p) =>
      p.partNumber.toLowerCase().includes(q) ||
      q.split(/\s+/).some((w) => w.length > 2 && p.name.toLowerCase().includes(w)),
  ).map((p) => ({ ...p, available: p.onHand - (state.reserved[p.partNumber] ?? 0) }));
}

/**
 * Creates a work order and reserves the spare if one is named.
 * @param {CmmsState} state mutated
 * @param {{machineId: string, problem: string, priority: WorkOrder['priority'], partNumber?: string, quantity?: number}} order
 * @param {Date} [now]
 * @returns {{workOrder: WorkOrder, reservation: string}}
 */
export function createWorkOrder(state, order, now = new Date()) {
  const id = `WO-${state.nextWorkOrder}`;
  state.nextWorkOrder += 1;
  const workOrder = { ...order, id, status: 'open', createdAt: now.toISOString() };
  state.workOrders.unshift(workOrder);
  const reservation = order.partNumber ? reserve(state, order.partNumber, order.quantity ?? 1) : 'No spare requested.';
  return { workOrder, reservation };
}

/**
 * Reserves stock if enough is available.
 * @param {CmmsState} state mutated
 * @param {string} partNumber
 * @param {number} quantity
 * @returns {string} what happened, in words the agent can say
 */
export function reserve(state, partNumber, quantity) {
  const part = INVENTORY.find((p) => p.partNumber === partNumber);
  if (!part) {
    return `Part ${partNumber} is not in the store list.`;
  }
  const available = part.onHand - (state.reserved[partNumber] ?? 0);
  if (available < quantity) {
    return `Only ${available} of ${partNumber} available; nothing reserved. Raise a purchase request.`;
  }
  state.reserved[partNumber] = (state.reserved[partNumber] ?? 0) + quantity;
  const left = available - quantity;
  const reorder = left <= part.reorderLevel ? ' Stock is now at or below reorder level.' : '';
  return `Reserved ${quantity} x ${partNumber} at ${part.store}. ${left} left.${reorder}`;
}

/**
 * Records a message to the supervisor on shift.
 * @param {CmmsState} state mutated
 * @param {{machineId: string, message: string, priority: string}} alert
 * @param {Date} [now]
 */
export function notifySupervisor(state, alert, now = new Date()) {
  const record = { ...alert, to: SUPERVISOR.name, channel: SUPERVISOR.channel, at: now.toISOString() };
  state.alerts.unshift(record);
  return record;
}

/**
 * Saves a technician's spoken fix as a knowledge draft for review.
 * @param {CmmsState} state mutated
 * @param {{machineId: string, symptom: string, cause: string, fix: string, parts: string}} draft
 */
export function captureFix(state, draft) {
  const record = { ...draft, id: `KB-${state.drafts.length + 1}`, status: 'awaiting supervisor review' };
  state.drafts.unshift(record);
  return record;
}
