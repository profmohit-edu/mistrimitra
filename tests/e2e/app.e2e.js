/**
 * End-to-end tests in a real Chromium: the scripted demo, a live text turn
 * against a fake Gemini Live socket, settings, reset and accessibility basics.
 * Run with `npm run test:e2e` (needs `npx playwright install chromium`).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, startHarness, stopHarness } from './harness.js';

before(startHarness);
after(stopHarness);

test('the scripted demo raises a work order only after the yes', async () => {
  const { page, ctx, errors } = await openApp();
  await page.click('#demo');
  await page.waitForSelector('#drafts li:has-text("KB-1")', { timeout: 30_000 });
  assert.match(await page.textContent('#actions'), /WO-2533/);
  assert.match(await page.textContent('#actions'), /R\. Sharma/);
  assert.match(await page.textContent('#safety'), /CNC-L3-07[^]*confirmed/);
  assert.doesNotMatch(await page.textContent('#transcript'), /Not confirmed yet/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('without a key, talking opens the settings dialog', async () => {
  const { page, ctx } = await openApp();
  await page.click('#talk');
  assert.ok(await page.isVisible('#settings'));
  assert.match(await page.textContent('#status'), /API key/);
  await ctx.close();
});

test('a typed turn goes to Gemini Live, runs the tool and shows the sourced answer', async () => {
  const { page, ctx, errors } = await openApp({ fakeLive: true });
  await page.click('#open-settings');
  await page.fill('#api-key', 'test-key');
  await page.click('#save-settings');
  await page.fill('#type-input', 'Line 3 CNC pe alarm 1014 aa raha hai');
  await page.click('#type-form button[type=submit]');
  await page.waitForSelector('.msg.agent');
  assert.match(await page.textContent('.msg.agent'), /VMC850/);
  assert.match(await page.textContent('#transcript'), /search_knowledge/);
  assert.match(await page.textContent('#sources'), /1014/);
  assert.match(await page.textContent('#lang-chip'), /Hinglish/);
  const sent = await page.evaluate(() => window.__live.sent);
  assert.equal(sent[0].setup.model, 'models/gemini-3.8-live');
  assert.ok(sent.some((m) => m.toolResponse?.functionResponses[0].name === 'search_knowledge'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('reset clears work orders', async () => {
  const { page, ctx } = await openApp();
  await page.click('#demo');
  await page.waitForSelector('#actions li:has-text("WO-2533")', { timeout: 30_000 });
  await page.waitForSelector('#demo:not([disabled])', { timeout: 30_000 });
  await page.click('#reset');
  assert.doesNotMatch(await page.textContent('#actions'), /WO-2533/);
  await ctx.close();
});

test('every control has an accessible name and the layout fits a phone', async () => {
  const { page, ctx } = await openApp({ viewport: { width: 390, height: 844 } });
  const unlabeled = await page.$$eval('input, button', (els) =>
    els.filter((e) => !(e.labels?.length || e.getAttribute('aria-label') || e.textContent.trim())).map((e) => e.id),
  );
  assert.deepEqual(unlabeled, []);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `page overflows by ${overflow}px`);
  await ctx.close();
});
