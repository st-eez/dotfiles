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
  test('save on non-NS page returns NotARecordPage error', async () => {
    const page = bm.getPage();
    await page.goto('about:blank');

    const raw = await nsSave([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('NotARecordPage');

    // Navigate back for subsequent tests
    await page.goto(baseUrl + '/ns-form.html');
  });

  test('save triggers save button and detects URL change with ?id=', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    // Success behavior: onclick navigates to same page with ?id=12345
    await page.evaluate(() => {
      (window as any).__saveBehavior = 'success';
    });

    const raw = await nsSave([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.saved).toBe(true);
    expect(result.data.recordId).toBe('12345');
    expect(result.data.url).toContain('?id=12345');
    expect(typeof result.elapsedMs).toBe('number');
  }, 15_000);

  test('save captures dialog on validation error', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    // Set validation error behavior
    await page.evaluate(() => {
      (window as any).__saveBehavior = 'validation';
    });

    const raw = await nsSave([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('Please enter a value for Company Name');
  }, 15_000);

  test('save captures dialog on concurrency error', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    // Set concurrency error behavior
    await page.evaluate(() => {
      (window as any).__saveBehavior = 'concurrency';
    });

    const raw = await nsSave([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ConcurrencyError');
    expect(result.error.message).toContain('record has been changed');
  }, 15_000);

  test('dialogs array is present in error results', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    await page.evaluate(() => {
      (window as any).__saveBehavior = 'validation';
    });

    const raw = await nsSave([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(Array.isArray(result.dialogs)).toBe(true);
    expect(result.dialogs.length).toBeGreaterThan(0);
    expect(result.dialogs[0].type).toBe('alert');
  }, 15_000);
});
