/**
 * Sample plant knowledge for the prototype: a fictional auto-component MSME.
 * All manual text, tickets and chats are written for this demo (no third-party
 * manuals are reproduced). Manuals are in English; shift chats are Hinglish,
 * as on a real shop floor.
 * @module data/plant
 */

/** @typedef {{id: string, name: string, model: string, line: string}} Machine */

/**
 * @typedef {object} Passage
 * @property {string} id citation id, e.g. "VMC850 §7.3"
 * @property {'manual'|'sop'|'ticket'|'chat'} kind
 * @property {string} machineId machine the passage is about, or "*" for plant-wide
 * @property {string} title
 * @property {string} text
 * @property {boolean} [requiresLoto] true for hands-on repair steps
 */

/** @type {Machine[]} */
export const MACHINES = [
  { id: 'CNC-L3-07', name: 'CNC machining centre', model: 'Vertex VMC-850', line: 'Line 3' },
  { id: 'PRS-L1-02', name: 'Hydraulic press 200 T', model: 'Kaveri HP-200', line: 'Line 1' },
  { id: 'CMP-U1-01', name: 'Screw air compressor', model: 'Pavan SC-37', line: 'Utilities' },
];

/** @type {Passage[]} */
export const MANUALS = [
  {
    id: 'VMC850 §7.3',
    kind: 'manual',
    machineId: 'CNC-L3-07',
    title: 'Alarm 1014: spindle overload',
    text: 'Alarm 1014 trips when spindle motor current stays above 120% of rated load for 3 seconds. Common causes: worn spindle bearings, a slipping or over-tight drive belt, a blunt tool, or low coolant flow at the cut. Check coolant flow and tool condition first; if the alarm repeats with a new tool, inspect the spindle bearings and belt.',
  },
  {
    id: 'VMC850 §7.4',
    kind: 'manual',
    machineId: 'CNC-L3-07',
    title: 'Spindle bearing inspection and replacement',
    requiresLoto: true,
    text: 'With the machine locked out, remove the rear spindle cover (6 x M6). Rotate the spindle by hand: roughness, clicking or play above 0.01 mm indicates bearing wear. Replacement bearing: 6205-2RS, pair. Press out the old bearings with the puller, clean the housing, fit new bearings, and run in at 500 rpm for 10 minutes before full speed.',
  },
  {
    id: 'VMC850 §6.2',
    kind: 'manual',
    machineId: 'CNC-L3-07',
    title: 'Drive belt tension',
    requiresLoto: true,
    text: 'Belt deflection should be 8 to 10 mm under thumb pressure at mid-span. Loosen the four motor plate bolts, adjust with the tension screw, retighten to 25 Nm. Replace the belt (part SB-850) if it shows glazing or cracks.',
  },
  {
    id: 'VMC850 §7.8',
    kind: 'manual',
    machineId: 'CNC-L3-07',
    title: 'Alarm 2031: coolant low pressure',
    text: 'Alarm 2031 means coolant pressure is below 2 bar. Check the tank level, the suction strainer and the pump rotation. A clogged strainer is the most common cause after long runs on cast iron.',
  },
  {
    id: 'HP200 §5.1',
    kind: 'manual',
    machineId: 'PRS-L1-02',
    title: 'Fault H21: hydraulic oil over-temperature',
    text: 'Fault H21 appears when oil temperature exceeds 65 °C. Check the oil cooler fan, the oil level and the return-line filter. Running above 70 °C damages seals; stop the press until the cause is found.',
  },
  {
    id: 'HP200 §5.4',
    kind: 'manual',
    machineId: 'PRS-L1-02',
    title: 'Return-line filter change',
    requiresLoto: true,
    text: 'Lock out the press and release accumulator pressure until the gauge reads zero. Unscrew the filter bowl, replace element RF-200, check the O-ring, and refill oil to the sight-glass mark.',
  },
  {
    id: 'SC37 §4.2',
    kind: 'manual',
    machineId: 'CMP-U1-01',
    title: 'High discharge temperature',
    text: 'Trips at 110 °C discharge temperature. Usual causes: blocked cooler fins, low oil, or a stuck thermostatic valve. Clean the cooler with low-pressure air from the fan side.',
  },
];

/** @type {Passage[]} */
export const SOPS = [
  {
    id: 'SOP-SAF-01',
    kind: 'sop',
    machineId: '*',
    title: 'Lockout/tagout (LOTO) before any hands-on work',
    text: 'Stop the machine, switch off the main isolator, fit your personal lock and tag, release stored energy (air, hydraulic, spring), and try to start the machine to prove it is dead. Only then remove covers. Wear gloves and safety glasses.',
  },
];

/** @type {Passage[]} */
export const TICKETS = [
  {
    id: 'WO-2291',
    kind: 'ticket',
    machineId: 'CNC-L3-07',
    title: 'Spindle noise and alarm 1014 (closed 12 Jun)',
    text: 'Rear spindle bearing pitted. Replaced bearing pair 6205-2RS. Belt tension was also low; adjusted to 9 mm deflection. Downtime 3.5 h.',
  },
  {
    id: 'WO-2417',
    kind: 'ticket',
    machineId: 'CNC-L3-07',
    title: 'Alarm 1014 again (closed 14 Aug)',
    text: 'Bearing noise at high rpm. Replaced 6205-2RS pair. Root cause: coolant leaking into spindle housing past worn wiper seal; seal replaced.',
  },
  {
    id: 'WO-2488',
    kind: 'ticket',
    machineId: 'PRS-L1-02',
    title: 'H21 over-temperature (closed 2 Oct)',
    text: 'Cooler fan fuse blown. Replaced fuse and cleaned cooler. Oil back to 48 °C within 20 minutes.',
  },
];

/** @type {Passage[]} */
export const CHATS = [
  {
    id: 'Shift chat, Mon night',
    kind: 'chat',
    machineId: 'CNC-L3-07',
    title: 'Night shift note',
    text: 'L3-07 pe high rpm par vibration zyada hai, spindle ke peeche se ghis-ghis ki awaaz. Sharma ji ko bataya hai. (Vibration high at high rpm, grinding noise from rear of spindle.)',
  },
  {
    id: 'Shift chat, Tue morning',
    kind: 'chat',
    machineId: 'PRS-L1-02',
    title: 'Morning shift note',
    text: 'Press L1-02 ka cooler fan dheere chal raha hai, tel garam ho raha hai. (Cooler fan running slow, oil getting hot.)',
  },
];

/** All searchable passages. */
export const PASSAGES = [...MANUALS, ...SOPS, ...TICKETS, ...CHATS];

/** @typedef {{partNumber: string, name: string, store: string, onHand: number, reorderLevel: number}} SparePart */

/** @type {SparePart[]} */
export const INVENTORY = [
  {
    partNumber: '6205-2RS',
    name: 'Spindle bearing (deep groove, sealed)',
    store: 'Store B, rack 4',
    onHand: 3,
    reorderLevel: 2,
  },
  { partNumber: 'SB-850', name: 'Spindle drive belt', store: 'Store B, rack 2', onHand: 1, reorderLevel: 1 },
  { partNumber: 'WS-850', name: 'Spindle wiper seal', store: 'Store B, rack 4', onHand: 4, reorderLevel: 2 },
  {
    partNumber: 'RF-200',
    name: 'Hydraulic return-line filter element',
    store: 'Store A, rack 1',
    onHand: 2,
    reorderLevel: 1,
  },
  { partNumber: 'FZ-10A', name: 'Fuse 10 A (cooler fan)', store: 'Electrical cabinet E2', onHand: 10, reorderLevel: 5 },
];

/** Supervisor on shift, notified for high-priority faults. */
export const SUPERVISOR = { name: 'R. Sharma', channel: 'Google Chat, Maintenance' };
