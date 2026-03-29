/**
 * Integration tests for ns add-row command.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { BrowserManager } from '../../core/browser-manager';
import { nsAddRow } from '../commands/ns-add-row';
import * as path from 'path';
import * as fs from 'fs';

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
      if (!fs.existsSync(fullPath)) return new Response('Not Found', { status: 404 });
      const content = fs.readFileSync(fullPath, 'utf-8');
      return new Response(content, { headers: { 'Content-Type': 'text/html' } });
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

beforeEach(async () => {
  // Fresh page state for each test
  await bm.getPage().goto(baseUrl + '/ns-form.html');
});

describe('ns add-row', () => {
  test('adds a row with field values', async () => {
    const raw = await nsAddRow(['item', 'item=300', 'quantity=10', 'rate=15.00', 'amount=150.00'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.sublist).toBe('item');
    expect(result.data.lineNumber).toBe(3); // 2 existing + 1 new
    expect(result.data.values.item).toBe('300');
    expect(result.data.values.quantity).toBe('10');
  });

  test('returns error for missing sublist ID', async () => {
    const raw = await nsAddRow([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('Missing sublist');
  });

  test('returns error for missing field values', async () => {
    const raw = await nsAddRow(['item'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('No field values');
  });

  test('returns NotARecordPage on non-NS page', async () => {
    await bm.getPage().goto('about:blank');
    const raw = await nsAddRow(['item', 'item=100'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('NotARecordPage');
  });

  test('includes dialogs array in result', async () => {
    const raw = await nsAddRow(['item', 'item=400', 'quantity=1'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(Array.isArray(result.data.dialogs)).toBe(true);
  });

  test('result includes timing info', async () => {
    const raw = await nsAddRow(['item', 'item=500', 'quantity=2'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(typeof result.data.elapsedMs).toBe('number');
    expect(result.data.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.data.settled).toBe('boolean');
  });
});
