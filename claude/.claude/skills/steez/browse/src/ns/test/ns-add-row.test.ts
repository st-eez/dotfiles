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
  await bm.getPage().goto(baseUrl + '/ns-form.html');
});

describe('ns add-row', () => {
  test('adds a row with field values', async () => {
    const output = await nsAddRow(['item', 'item=300', 'quantity=10', 'rate=15.00', 'amount=150.00'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('ADD-ROW OK');
    expect(output.display).toContain('Sublist: item');
    expect(output.display).toContain('Line: 3'); // 2 existing + 1 new
    expect(output.display).toContain('Values:');
    expect(output.display).toContain('item=300');
    expect(output.display).toContain('quantity=10');
  });

  test('returns error for missing sublist ID', async () => {
    const output = await nsAddRow([], bm);

    expect(output.ok).toBe(false);
    expect(output.display).toContain('Missing sublist');
  });

  test('returns error for missing field values', async () => {
    const output = await nsAddRow(['item'], bm);

    expect(output.ok).toBe(false);
    expect(output.display).toContain('No field values');
  });

  test('returns error on non-NS page', async () => {
    await bm.getPage().goto('about:blank');
    const output = await nsAddRow(['item', 'item=100'], bm);

    expect(output.ok).toBe(false);
    expect(output.display).toContain('NotARecordPage');
  });

  test('successful add-row has no Dialog line when empty', async () => {
    const output = await nsAddRow(['item', 'item=400', 'quantity=1'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).not.toContain('Dialog');
  });

  test('display includes settled status', async () => {
    const output = await nsAddRow(['item', 'item=500', 'quantity=2'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toMatch(/Settled: (yes|no)/);
  });
});
