/**
 * Tests for ns status command.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { BrowserManager } from '../../core/browser-manager';
import { nsStatus } from '../commands/ns-status';
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

// ─── ns status ─────────────────────────────────────────────

describe('ns status', () => {
  test('returns status on a valid NS form page', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const raw = await nsStatus([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.url).toContain('/ns-form.html');
    expect(result.data.sessionValid).toBe(true);
    expect(result.data.mode).toBe('create');
    expect(result.data.modal).toBeNull();
    expect(typeof result.elapsedMs).toBe('number');
  });

  test('returns NotARecordPage on about:blank', async () => {
    const page = bm.getPage();
    await page.goto('about:blank');

    const raw = await nsStatus([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('NotARecordPage');

    // Navigate back for subsequent tests
    await page.goto(baseUrl + '/ns-form.html');
  });

  test('returns sessionValid: true on a normal page', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const raw = await nsStatus([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.sessionValid).toBe(true);
  });

  test('detects edit mode from URL params', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html?id=123&e=T');

    const raw = await nsStatus([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.mode).toBe('edit');

    await page.goto(baseUrl + '/ns-form.html');
  });

  test('detects view mode from URL params', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html?id=456');

    const raw = await nsStatus([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.mode).toBe('view');

    await page.goto(baseUrl + '/ns-form.html');
  });

  test('recordType is null for non-NS URL patterns', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const raw = await nsStatus([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    // Local test server URL does not match any RECORD_URL_MAP slug
    expect(result.data.recordType).toBeNull();
  });

  test('detects visible DOM modal', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');
    await page.evaluate(() => (window as any).__showError('#_err_alert'));

    const raw = await nsStatus([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.modal).not.toBeNull();
    expect(result.data.modal.type).toBe('error');
    expect(result.data.modal.message).toContain('Validation error');

    // Clean up
    await page.evaluate(() => (window as any).__hideError('#_err_alert'));
  });
});
