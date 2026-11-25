/**
 * Shared harness for the browser tests: a static file server for the repo,
 * one Chromium, and a page opener that can replace the Gemini Live socket
 * with a scripted fake.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

let server;
/** @type {import('playwright').Browser | undefined} */
export let browser;
let origin = '';

export async function startHarness() {
  server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    try {
      const body = await readFile(join(ROOT, path || 'index.html'));
      res.writeHead(200, { 'content-type': TYPES[extname(path || '.html')] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch(process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {});
}

export async function stopHarness() {
  await browser?.close();
  server?.close();
}

/**
 * A fake Gemini Live socket. On any text turn it asks for a search, then
 * (after the tool response) speaks a sourced answer with transcription.
 */
function installFakeLive() {
  class FakeLive {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      window.__live = this;
      this.sent = [];
      setTimeout(() => {
        this.readyState = 1;
        this.onopen?.();
      }, 10);
    }
    emit(msg) {
      setTimeout(() => this.onmessage?.({ data: JSON.stringify(msg) }), 10);
    }
    send(raw) {
      const msg = JSON.parse(raw);
      this.sent.push(msg);
      if (msg.setup) {
        this.emit({ setupComplete: {} });
      } else if (msg.realtimeInput?.text) {
        const args = { query: msg.realtimeInput.text, machine_id: 'CNC-L3-07' };
        this.emit({ toolCall: { functionCalls: [{ id: 'c1', name: 'search_knowledge', args }] } });
      } else if (msg.toolResponse) {
        this.emit({
          serverContent: {
            outputTranscription: { text: 'Alarm 1014 matlab spindle overload, VMC850 section 7.3.' },
            modelTurn: { parts: [{ inlineData: { data: 'AAAAAA==', mimeType: 'audio/pcm;rate=24000' } }] },
            turnComplete: true,
          },
        });
      }
    }
    close() {
      this.readyState = 3;
    }
  }
  window.WebSocket = /** @type {any} */ (FakeLive);
}

/** @param {{fakeLive?: boolean, viewport?: {width: number, height: number}}} [opts] */
export async function openApp({ fakeLive = false, viewport = { width: 1280, height: 900 } } = {}) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  if (fakeLive) {
    await page.addInitScript(installFakeLive);
  }
  await page.goto(`${origin}/index.html`);
  return { page, ctx, errors };
}
