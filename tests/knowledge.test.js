import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, searchKnowledge, tokenize } from '../src/knowledge.js';
import { PASSAGES } from '../src/data/plant.js';

test('tokenize keeps part numbers and expands Hinglish words', () => {
  const t = tokenize('Bearing 6205-2RS mein awaaz aa rahi hai');
  assert.ok(t.includes('6205-2rs'));
  assert.ok(t.includes('noise'));
});

test('alarm 1014 finds the manual section first', () => {
  const [top] = searchKnowledge('Line 3 CNC pe alarm 1014 aa raha hai');
  assert.equal(top.machineId, 'CNC-L3-07');
  assert.match(top.title, /1014/);
});

test('repair steps are withheld until lockout is confirmed', () => {
  const locked = searchKnowledge('spindle bearing replace kaise karun', { machineId: 'CNC-L3-07' });
  const bearing = locked.find((h) => h.id.includes('7.4'));
  assert.ok(bearing?.withheld);
  assert.match(bearing.text, /withheld/i);
  const open = searchKnowledge('spindle bearing replace kaise karun', {
    machineId: 'CNC-L3-07',
    lotoConfirmed: new Set(['CNC-L3-07']),
  });
  const unlocked = open.find((h) => h.id === bearing.id);
  assert.equal(unlocked?.withheld, false);
  assert.doesNotMatch(unlocked.text, /withheld/i);
});

test('lockout on one machine does not unlock another', () => {
  const hits = searchKnowledge('press filter change', { lotoConfirmed: new Set(['CNC-L3-07']), topK: 10 });
  const filter = hits.find((h) => h.machineId === 'PRS-L1-02' && h.withheld);
  assert.ok(filter);
});

test('machine filter and empty queries behave', () => {
  const hits = searchKnowledge('temperature', { machineId: 'CMP-U1-01', topK: 10 });
  assert.ok(hits.length > 0);
  assert.ok(hits.every((h) => h.machineId === 'CMP-U1-01' || h.machineId === 'plant'));
  assert.deepEqual(searchKnowledge('   '), []);
});

test('a custom index can be passed', () => {
  const index = buildIndex(PASSAGES.slice(0, 2));
  const hits = searchKnowledge('spindle', { index, topK: 5 });
  assert.ok(hits.length <= 2);
});
