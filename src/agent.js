/**
 * The agent's tools and rules. Safety is enforced in code, not only in the
 * prompt: repair steps stay hidden until lockout/tagout is confirmed, and a
 * work order is written only after the technician has spoken again following
 * the read-back.
 * @module agent
 */
import { MACHINES, SUPERVISOR } from './data/plant.js';
import { searchKnowledge } from './knowledge.js';
import { captureFix, clean, createWorkOrder, findSpares, notifySupervisor } from './cmms.js';
import { TOOL_DECLARATIONS } from './tools.js';

export { TOOL_DECLARATIONS };

/**
 * @typedef {object} AgentState
 * @property {import('./cmms.js').CmmsState} cmms
 * @property {Set<string>} loto machines with lockout/tagout confirmed
 * @property {Map<string, {order: any, userTurn: number}>} drafts work orders awaiting confirmation
 * @property {number} userTurn increments each time the technician speaks or types
 * @property {import('./knowledge.js').SearchHit[]} lastSources
 */

/**
 * @param {import('./cmms.js').CmmsState} cmms
 * @returns {AgentState}
 */
export function newAgentState(cmms) {
  return { cmms, loto: new Set(), drafts: new Map(), userTurn: 0, lastSources: [] };
}

/** System instruction: persona, language and safety rules. */
export const SYSTEM_INSTRUCTION = [
  'You are MistriMitra, a voice co-pilot for maintenance technicians on an Indian factory floor.',
  "Reply in the technician's language and style (Hindi, Hinglish, Marathi, Tamil, English). Keep answers short: two or three sentences, then stop.",
  `Machines: ${MACHINES.map((m) => `${m.id} (${m.name}, ${m.line})`).join('; ')}.`,
  'Before any how or why answer, call search_knowledge with an English query, then answer only from the returned passages and name the source aloud, for example "manual section 7.3" or "work order 2417".',
  'If nothing relevant is returned, say you do not know and offer to alert the supervisor. Never invent alarm codes, torque values or part numbers.',
  'Safety: if a passage says repair steps are withheld, ask the technician to complete lockout/tagout. Call confirm_lockout only after they say it is done.',
  'Actions: call propose_work_order, read the order back in one sentence, and wait. Call confirm_work_order only after the technician clearly says yes (haan, theek hai, kar do).',
  'Say a short filler such as "ek second, dekh raha hoon" while tools run. Repeat numbers back.',
  `For high priority or safety issues, call notify_supervisor (${SUPERVISOR.name}).`,
  'After a job is closed, ask "kya kiya?" and save the answer with capture_fix.',
].join('\n');

/** @param {any} args @param {string} key */
const machineArg = (args, key = 'machine_id') => {
  const id = clean(args?.[key]).toUpperCase();
  return MACHINES.some((m) => m.id === id) ? id : '';
};

/** Tool implementations. Each returns a plain object the model can read. */
const TOOLS = {
  /** @param {AgentState} s @param {any} a */
  search_knowledge(s, a) {
    const hits = searchKnowledge(clean(a.query), { machineId: machineArg(a) || undefined, lotoConfirmed: s.loto });
    s.lastSources = hits;
    return { results: hits.map(({ id, title, text, withheld }) => ({ source: id, title, text, withheld })) };
  },
  /** @param {AgentState} s @param {any} a */
  confirm_lockout(s, a) {
    const id = machineArg(a);
    if (!id) {
      return { error: 'Unknown machine. Ask which machine is locked out.' };
    }
    s.loto.add(id);
    return { confirmed: id, reminder: 'Prove the machine is dead by trying to start it. Gloves and glasses on.' };
  },
  /** @param {AgentState} s @param {any} a */
  get_machine_history(s, a) {
    const id = machineArg(a);
    const hits = searchKnowledge(`${id} history`, { machineId: id, lotoConfirmed: s.loto, topK: 10 });
    const history = hits.filter((h) => h.kind === 'ticket' || h.kind === 'chat');
    return { machine: id, history: history.map(({ id: source, title, text }) => ({ source, title, text })) };
  },
  /** @param {AgentState} s @param {any} a */
  check_spare(s, a) {
    return { parts: findSpares(s.cmms, a.part_query) };
  },
  /** @param {AgentState} s @param {any} a */
  propose_work_order(s, a) {
    const machineId = machineArg(a);
    if (!machineId) {
      return { error: 'Unknown machine. Ask which machine needs the work order.' };
    }
    const priority = ['low', 'medium', 'high'].includes(a.priority) ? a.priority : 'medium';
    const order = {
      machineId,
      problem: clean(a.problem),
      priority,
      partNumber: clean(a.part_number) || undefined,
      quantity: Number(a.quantity) || 1,
    };
    const draftId = `D${s.drafts.size + 1}`;
    s.drafts.set(draftId, { order, userTurn: s.userTurn });
    const part = order.partNumber ? `, reserve ${order.quantity} x ${order.partNumber}` : '';
    return {
      draft_id: draftId,
      read_back: `Work order for ${machineId}: ${order.problem}, priority ${priority}${part}. Shall I raise it?`,
    };
  },
  /** @param {AgentState} s @param {any} a */
  confirm_work_order(s, a) {
    const draft = s.drafts.get(clean(a.draft_id));
    if (!draft) {
      return { error: 'No such draft. Propose the work order first.' };
    }
    if (s.userTurn <= draft.userTurn) {
      return { error: 'Not confirmed yet. Read the order back and wait for the technician to say yes.' };
    }
    s.drafts.delete(clean(a.draft_id));
    const { workOrder, reservation } = createWorkOrder(s.cmms, draft.order);
    return { work_order: workOrder.id, status: workOrder.status, reservation };
  },
  /** @param {AgentState} s @param {any} a */
  notify_supervisor(s, a) {
    const alert = notifySupervisor(s.cmms, {
      machineId: machineArg(a) || 'plant',
      message: clean(a.message),
      priority: clean(a.priority) || 'high',
    });
    return { sent_to: alert.to, channel: alert.channel };
  },
  /** @param {AgentState} s @param {any} a */
  capture_fix(s, a) {
    const draft = captureFix(s.cmms, {
      machineId: machineArg(a) || 'plant',
      symptom: clean(a.symptom),
      cause: clean(a.cause),
      fix: clean(a.fix),
      parts: clean(a.parts),
    });
    return { draft: draft.id, status: draft.status };
  },
};

/**
 * Runs one tool call from the model. Unknown tools and failures come back as
 * `{error}` so the model can recover in conversation.
 * @param {AgentState} state
 * @param {{name: string, args?: object}} call
 * @returns {object}
 */
export function runTool(state, call) {
  const tool = Object.hasOwn(TOOLS, call.name) ? TOOLS[/** @type {keyof typeof TOOLS} */ (call.name)] : null;
  if (!tool) {
    return { error: `Unknown tool ${call.name}.` };
  }
  try {
    return tool(state, call.args ?? {});
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
