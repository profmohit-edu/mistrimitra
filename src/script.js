/**
 * A scripted walkthrough for visitors without an API key. The technician's
 * lines and the agent's replies are pre-written, but every tool call runs
 * for real against the same knowledge base, safety gate and mock CMMS.
 * @module script
 */

/**
 * @typedef {object} ScriptStep
 * @property {string} user what the technician says
 * @property {Array<{name: string, args: object}>} tools tool calls the agent makes
 * @property {(results: any[]) => string} reply the agent's spoken answer, built from real tool results
 */

/** @type {ScriptStep[]} */
export const DEMO_SCRIPT = [
  {
    user: 'Line 3 CNC pe alarm 1014 aa raha hai, spindle do baar trip hua.',
    tools: [
      { name: 'search_knowledge', args: { query: 'alarm 1014 spindle overload', machine_id: 'CNC-L3-07' } },
      { name: 'get_machine_history', args: { machine_id: 'CNC-L3-07' } },
    ],
    reply: ([search, history]) =>
      `Alarm 1014 matlab spindle overload (${search.results[0].source}). Is machine pe pehle bhi bearing badla gaya: ${history.history
        .filter((x) => x.source.startsWith('WO'))
        .map((x) => x.source)
        .join(', ')}. Pehle coolant flow aur tool check kijiye. Bearing kholna ho to pehle LOTO kijiye.`,
  },
  {
    user: 'Tool naya hai, phir bhi trip. LOTO ho gaya hai, ab bearing kaise check karun?',
    tools: [
      { name: 'confirm_lockout', args: { machine_id: 'CNC-L3-07' } },
      { name: 'search_knowledge', args: { query: 'spindle bearing inspection replacement', machine_id: 'CNC-L3-07' } },
    ],
    reply: ([, search]) => {
      const hit = search.results.find((r) => !r.withheld && r.source.includes('7.4'));
      return `Theek hai, LOTO confirm. ${hit ? hit.source : 'Manual'} ke hisaab se: peeche ka cover kholiye, spindle haath se ghumaiye. Khurdurapan ya 0.01 mm se zyada play ho to bearing 6205-2RS ki jodi badalni hogi.`;
    },
  },
  {
    user: 'Haan, ghis-ghis ki awaaz hai. Work order bana do aur bearing reserve kar do.',
    tools: [
      { name: 'check_spare', args: { part_query: '6205-2RS' } },
      {
        name: 'propose_work_order',
        args: {
          machine_id: 'CNC-L3-07',
          problem: 'Spindle bearing worn, alarm 1014',
          priority: 'high',
          part_number: '6205-2RS',
          quantity: '2',
        },
      },
    ],
    reply: ([spare, draft]) => `Store mein ${spare.parts[0].available} hain. ${draft.read_back}`,
  },
  {
    user: 'Haan, bana do.',
    tools: [
      { name: 'confirm_work_order', args: { draft_id: 'D1' } },
      {
        name: 'notify_supervisor',
        args: {
          machine_id: 'CNC-L3-07',
          message: 'Alarm 1014 on Line 3 CNC, spindle bearing change, high priority.',
          priority: 'high',
        },
      },
    ],
    reply: ([wo, alert]) =>
      `${wo.work_order} ban gaya, priority high. ${wo.reservation} ${alert.sent_to} ko bata diya.`,
  },
  {
    user: 'Kaam ho gaya. Wiper seal bhi ghisa tha, coolant andar ja raha tha, woh bhi badla.',
    tools: [
      {
        name: 'capture_fix',
        args: {
          machine_id: 'CNC-L3-07',
          symptom: 'Alarm 1014, grinding noise at high rpm',
          cause: 'Coolant entering spindle housing past a worn wiper seal',
          fix: 'Replaced bearing pair 6205-2RS and wiper seal WS-850',
          parts: '6205-2RS x2, WS-850 x1',
        },
      },
    ],
    reply: ([draft]) =>
      `Shabash. Yeh fix ${draft.draft} mein save kar diya, supervisor review ke baad sabko milega. Agli baar yeh seal pehle check karenge.`,
  },
];
