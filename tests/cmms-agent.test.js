import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureFix, createWorkOrder, emptyCmms, findSpares, notifySupervisor, reserve } from '../src/cmms.js';
import { newAgentState, runTool, SYSTEM_INSTRUCTION, TOOL_DECLARATIONS } from '../src/agent.js';
import { DEMO_SCRIPT } from '../src/script.js';

const NOW = new Date('2026-11-25T10:00:00Z');

test('work orders get sequential numbers and reserve spares', () => {
  const s = emptyCmms();
  const a = createWorkOrder(
    s,
    { machineId: 'CNC-L3-07', problem: 'x', priority: 'high', partNumber: '6205-2RS', quantity: 2 },
    NOW,
  );
  const b = createWorkOrder(s, { machineId: 'PRS-L1-02', problem: 'y', priority: 'low' }, NOW);
  assert.equal(a.workOrder.id, 'WO-2533');
  assert.equal(b.workOrder.id, 'WO-2534');
  assert.match(a.reservation, /Reserved 2 x 6205-2RS/);
  assert.match(a.reservation, /reorder level/);
  assert.equal(b.reservation, 'No spare requested.');
  assert.equal(findSpares(s, '6205')[0].available, 1);
});

test('reserve refuses more than is in stock and unknown parts', () => {
  const s = emptyCmms();
  assert.match(reserve(s, '6205-2RS', 9), /nothing reserved/);
  assert.match(reserve(s, 'NOPE', 1), /not in the store list/);
  assert.deepEqual(s.reserved, {});
});

test('spares can be found by name words', () => {
  assert.ok(findSpares(emptyCmms(), 'wiper seal').some((p) => p.partNumber === 'WS-850'));
});

test('supervisor alerts and fix drafts are recorded', () => {
  const s = emptyCmms();
  const alert = notifySupervisor(s, { machineId: 'CNC-L3-07', message: 'm', priority: 'high' }, NOW);
  assert.equal(alert.to, 'R. Sharma');
  const kb = captureFix(s, { machineId: 'CNC-L3-07', symptom: 'a', cause: 'b', fix: 'c', parts: 'd' });
  assert.equal(kb.id, 'KB-1');
  assert.equal(kb.status, 'awaiting supervisor review');
});

test('a work order cannot be confirmed in the same turn it was proposed', () => {
  const st = newAgentState(emptyCmms());
  const draft = runTool(st, {
    name: 'propose_work_order',
    args: { machine_id: 'cnc-l3-07', problem: 'p', priority: 'high' },
  });
  assert.equal(draft.draft_id, 'D1');
  assert.match(draft.read_back, /Shall I raise it/);
  const early = runTool(st, { name: 'confirm_work_order', args: { draft_id: 'D1' } });
  assert.match(early.error, /Not confirmed yet/);
  st.userTurn += 1;
  const ok = runTool(st, { name: 'confirm_work_order', args: { draft_id: 'D1' } });
  assert.equal(ok.work_order, 'WO-2533');
  assert.match(runTool(st, { name: 'confirm_work_order', args: { draft_id: 'D1' } }).error, /No such draft/);
});

test('lockout must name a real machine and unlocks only that machine', () => {
  const st = newAgentState(emptyCmms());
  assert.match(runTool(st, { name: 'confirm_lockout', args: { machine_id: 'X' } }).error, /Unknown machine/);
  runTool(st, { name: 'confirm_lockout', args: { machine_id: 'CNC-L3-07' } });
  assert.deepEqual([...st.loto], ['CNC-L3-07']);
});

test('unknown tools, bad machines and bad priority are handled', () => {
  const st = newAgentState(emptyCmms());
  assert.match(runTool(st, { name: 'rm_rf' }).error, /Unknown tool/);
  assert.match(runTool(st, { name: 'toString' }).error, /Unknown tool/);
  assert.match(runTool(st, { name: 'propose_work_order', args: { machine_id: 'nope' } }).error, /Unknown machine/);
  const d = runTool(st, {
    name: 'propose_work_order',
    args: { machine_id: 'PRS-L1-02', problem: 'p', priority: 'urgent!!' },
  });
  assert.match(d.read_back, /priority medium/);
});

test('search, history and spare tools return sources', () => {
  const st = newAgentState(emptyCmms());
  const found = runTool(st, { name: 'search_knowledge', args: { query: 'alarm 1014', machine_id: 'CNC-L3-07' } });
  assert.ok(found.results.length > 0);
  assert.ok(st.lastSources.length > 0);
  const hist = runTool(st, { name: 'get_machine_history', args: { machine_id: 'CNC-L3-07' } });
  assert.ok(JSON.stringify(hist).includes('WO-2417'));
  const spare = runTool(st, { name: 'check_spare', args: { query: '6205-2RS' } });
  assert.ok(JSON.stringify(spare).includes('Store B'));
});

test('every declared tool has an implementation', () => {
  const st = newAgentState(emptyCmms());
  for (const d of TOOL_DECLARATIONS) {
    const r = runTool(st, { name: d.name, args: {} });
    assert.doesNotMatch(String(r.error ?? ''), /Unknown tool/, d.name);
  }
  assert.match(SYSTEM_INSTRUCTION, /lockout/i);
});

test('the scripted demo runs end to end with the real tools', () => {
  const st = newAgentState(emptyCmms());
  for (const step of DEMO_SCRIPT) {
    st.userTurn += 1;
    const results = step.tools.map((call) => runTool(st, call));
    results.forEach((r) => assert.equal(r.error, undefined, JSON.stringify(r)));
    assert.ok(step.reply(results).length > 0);
  }
  assert.equal(st.cmms.workOrders[0].id, 'WO-2533');
  assert.equal(st.cmms.drafts.length, 1);
});
