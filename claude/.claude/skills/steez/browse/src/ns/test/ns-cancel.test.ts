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
  test('cancel on a valid NS page returns CANCEL OK', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const output = await nsCancel([], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('CANCEL OK');
  });

  test('cancel on non-NS page returns error', async () => {
    const page = bm.getPage();
    await page.goto('about:blank');

    const output = await nsCancel([], bm);

    expect(output.ok).toBe(false);
    expect(output.display).toContain('ns cancel failed');
    expect(output.display).toContain('NotARecordPage');

    // Navigate back for subsequent tests
    await page.goto(baseUrl + '/ns-form.html');
  });

  test('successful cancel has no dialogs line when empty', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const output = await nsCancel([], bm);

    expect(output.ok).toBe(true);
    expect(output.display).not.toContain('Dialogs:');
  });
});
