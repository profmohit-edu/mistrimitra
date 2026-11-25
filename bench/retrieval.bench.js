/* eslint-disable no-console -- a command-line benchmark prints its results. */
/**
 * Retrieval benchmark: does search_knowledge put the right source first?
 * Run with `node bench/retrieval.bench.js`.
 */
import { performance } from 'node:perf_hooks';
import { searchKnowledge } from '../src/knowledge.js';

import { CASES } from './cases.js';

let top1 = 0;
let top3 = 0;
const misses = [];
const t0 = performance.now();
for (const [query, expected, machineId] of CASES) {
  const ids = searchKnowledge(query, { machineId: machineId || undefined, topK: 3 }).map((h) => h.id);
  top1 += ids[0] === expected ? 1 : 0;
  top3 += ids.includes(expected) ? 1 : 0;
  if (ids[0] !== expected) {
    misses.push(`${query} → ${ids.join(', ')} (want ${expected})`);
  }
}
const ms = (performance.now() - t0) / CASES.length;
console.log(
  `cases ${CASES.length}  top-1 ${top1}/${CASES.length}  top-3 ${top3}/${CASES.length}  avg ${ms.toFixed(2)} ms/query`,
);
misses.forEach((m) => console.log('  miss:', m));
