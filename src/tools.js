/**
 * Function declarations sent to Gemini in the Live session setup.
 * @module tools
 */

/** @param {Record<string, string>} props @param {string[]} required */
const schema = (props, required) => ({
  type: 'object',
  properties: Object.fromEntries(Object.entries(props).map(([k, description]) => [k, { type: 'string', description }])),
  required,
});

const MACHINE = 'Machine ID such as CNC-L3-07, PRS-L1-02 or CMP-U1-01.';

export const TOOL_DECLARATIONS = [
  {
    name: 'search_knowledge',
    description:
      'Search OEM manuals, SOPs, past work orders and shift chats. Returns passages with a source id to cite.',
    parameters: schema({ query: 'Search terms in English, e.g. "alarm 1014 spindle overload".', machine_id: MACHINE }, [
      'query',
    ]),
  },
  {
    name: 'confirm_lockout',
    description: 'Record that the technician has completed lockout/tagout on a machine. Call only after they say so.',
    parameters: schema({ machine_id: MACHINE }, ['machine_id']),
  },
  {
    name: 'get_machine_history',
    description: 'Recent work orders and shift notes for a machine.',
    parameters: schema({ machine_id: MACHINE }, ['machine_id']),
  },
  {
    name: 'check_spare',
    description: 'Check stock and location of a spare part by part number or name.',
    parameters: schema({ part_query: 'Part number or name, e.g. "6205-2RS" or "bearing".' }, ['part_query']),
  },
  {
    name: 'propose_work_order',
    description: 'Draft a work order and get a one-sentence read-back. Does not create it.',
    parameters: schema(
      {
        machine_id: MACHINE,
        problem: 'Short problem description.',
        priority: 'low, medium or high.',
        part_number: 'Spare to reserve, if any.',
        quantity: 'How many of the spare.',
      },
      ['machine_id', 'problem', 'priority'],
    ),
  },
  {
    name: 'confirm_work_order',
    description:
      'Create the drafted work order and reserve its spare. Only after the technician said yes to the read-back.',
    parameters: schema({ draft_id: 'Draft id from propose_work_order.' }, ['draft_id']),
  },
  {
    name: 'notify_supervisor',
    description: 'Message the supervisor on shift about a high-priority or safety issue.',
    parameters: schema(
      { machine_id: MACHINE, message: 'What happened and what is needed.', priority: 'high or medium.' },
      ['message'],
    ),
  },
  {
    name: 'capture_fix',
    description: 'Save how the technician fixed a fault as a knowledge-base draft for supervisor review.',
    parameters: schema(
      {
        machine_id: MACHINE,
        symptom: 'What was seen or heard.',
        cause: 'Root cause.',
        fix: 'What was done.',
        parts: 'Parts used.',
      },
      ['machine_id', 'symptom', 'fix'],
    ),
  },
];
