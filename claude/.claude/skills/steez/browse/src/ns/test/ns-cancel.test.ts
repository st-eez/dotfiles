/**
 * Tests for ns cancel command.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { BrowserManager } from '../../core/browser-manager';
import { nsCancel } from '../commands/ns-cancel';
import * as path from 'path';
import * as fs from 'fs';

// ─── Test server ────────────────────────────────────────────

const FIXTURES_DIR = path.resolve(import.meta.dir, 'fixtures');

function startTestServer(port: number = 0) {
  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',
    fetch(req) {
      const url = new URL(req.url);
      let filePath = url.pathname === '/' ? '/ns-form.html' : url.pathname;
      filePath = filePath.replace(/^\//, '');
      const fullPath = path.join(FIXTURES_DIR, filePath);

      if (!fs.existsSync(fullPath)) {
        return new Response('Not Found', { status: 404 });
      }

      const content = fs.readFileSync(fullPath, 'utf-8');
      return new Response(content, {
        headers: { 'Content-Type': 'text/html' },
      });
    },
  });
  return { server, url: `http://127.0.0.1:${server.port}` };
}

let testServer: ReturnType<typeof startTestServer>;
let bm: BrowserManager;
let baseUrl: string;

beforeAll(async () => {
  testServer = startTestServer(0);
  baseUrl = testServer.url;
  bm = new BrowserManager();
  await bm.launch();
});

afterAll(() => {
  try { testServer.server.stop(); } catch {}
  setTimeout(() => process.exit(0), 500);
});

// ─── ns cancel ─────────────────────────────────────────────

describe('ns cancel', () => {
  test('cancel on a valid NS page returns cancelled: true', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const raw = await nsCancel([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.cancelled).toBe(true);
    expect(typeof result.elapsedMs).toBe('number');
  });

  test('cancel on non-NS page returns NotARecordPage error', async () => {
    const page = bm.getPage();
    await page.goto('about:blank');

    const raw = await nsCancel([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('NotARecordPage');

    // Navigate back for subsequent tests
    await page.goto(baseUrl + '/ns-form.html');
  });

  test('dialogs array is present in result data', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const raw = await nsCancel([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(Array.isArray(result.data.dialogs)).toBe(true);
  });
});
