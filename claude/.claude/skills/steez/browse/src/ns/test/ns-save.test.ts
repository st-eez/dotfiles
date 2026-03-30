/**
 * Tests for ns save command.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { BrowserManager } from '../../core/browser-manager';
import { nsSave } from '../commands/ns-save';
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

// ─── ns save ──────────────────────────────────────────────

describe('ns save', () => {
  test('save on non-NS page returns error', async () => {
    const page = bm.getPage();
    await page.goto('about:blank');

    const output = await nsSave([], bm);

    expect(output.ok).toBe(false);
    expect(output.display).toContain('ns save failed');
    expect(output.display).toContain('NotARecordPage');

    await page.goto(baseUrl + '/ns-form.html');
  });

  test('save triggers save button and detects URL change with ?id=', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    await page.evaluate(() => {
      (window as any).__saveBehavior = 'success';
    });

    const output = await nsSave([], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('SAVE OK');
    expect(output.display).toContain('Record: 12345');
    expect(output.display).toContain('id=12345');
    expect(output.metadata?.recordId).toBe('12345');
  }, 15_000);

  test('save captures dialog on validation error', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    await page.evaluate(() => {
      (window as any).__saveBehavior = 'validation';
    });

    const output = await nsSave([], bm);

    expect(output.ok).toBe(false);
    expect(output.display).toContain('ns save failed');
    expect(output.display).toContain('Please enter a value for Company Name');
  }, 15_000);

  test('save captures dialog on concurrency error', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    await page.evaluate(() => {
      (window as any).__saveBehavior = 'concurrency';
    });

    const output = await nsSave([], bm);

    expect(output.ok).toBe(false);
    expect(output.display).toContain('ns save failed');
    expect(output.display).toContain('ConcurrencyError');
  }, 15_000);

  test('error includes Dialog lines from captured dialogs', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    await page.evaluate(() => {
      (window as any).__saveBehavior = 'validation';
    });

    const output = await nsSave([], bm);

    expect(output.ok).toBe(false);
    expect(output.display).toContain('Dialog (alert)');
  }, 15_000);
});
