/**
 * Tests for ns set command.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { BrowserManager } from '../../core/browser-manager';
import { nsSet } from '../commands/ns-set';
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

// ─── ns set ───────────────────────────────────────────────

describe('ns set', () => {
  beforeEach(async () => {
    // Reset to a fresh page before each test
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');
  });

  test('set text field suppresses cascading', async () => {
    const raw = await nsSet(['companyname', 'New Company'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.fieldId).toBe('companyname');
    expect(result.data.value).toBe('New Company');
    expect(result.data.cascading).toBe('suppressed');
    expect(result.data.settled).toBe(true);
    expect(typeof result.elapsedMs).toBe('number');

    // Verify value was actually set
    const page = bm.getPage();
    const actual = await page.evaluate(() => (window as any).nlapiGetFieldValue('companyname'));
    expect(actual).toBe('New Company');
  });

  test('set entity-ref field auto-detects and fires cascading', async () => {
    const raw = await nsSet(['salesrep', '99'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.fieldId).toBe('salesrep');
    expect(result.data.value).toBe('99');
    expect(result.data.cascading).toBe('fired');
    expect(result.data.settled).toBe(true);
    expect(typeof result.elapsedMs).toBe('number');

    // The mock sourcing cascade should have updated companyname
    const page = bm.getPage();
    const companyValue = await page.evaluate(() => (window as any).nlapiGetFieldValue('companyname'));
    expect(companyValue).toBe('Sourced Company');

    // Diff should include the cascaded change
    expect(result.data.diff.changed.length).toBeGreaterThan(0);
    const companyChange = result.data.diff.changed.find((c: any) => c.id === 'companyname');
    expect(companyChange).toBeDefined();
    expect(companyChange.before).toBe('Acme Corp');
    expect(companyChange.after).toBe('Sourced Company');
  });

  test('--source flag forces cascading on text field', async () => {
    const raw = await nsSet(['companyname', 'Forced', '--source'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.cascading).toBe('fired');
    expect(result.data.settled).toBe(true);
  });

  test('--no-source flag suppresses cascading on entity-ref field', async () => {
    const raw = await nsSet(['salesrep', '99', '--no-source'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.cascading).toBe('suppressed');

    // With cascading suppressed, diff.changed should be empty
    expect(result.data.diff.changed).toEqual([]);
  });

  test('set nonexistent field returns validation error', async () => {
    const raw = await nsSet(['nonexistent', 'value'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('nonexistent');
    expect(result.error.message).toContain('not found');
  });

  test('set on non-NS page returns NotARecordPage', async () => {
    const page = bm.getPage();
    await page.goto('about:blank');

    const raw = await nsSet(['companyname', 'test'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('NotARecordPage');
  });

  test('missing args returns validation error', async () => {
    const raw = await nsSet([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('Missing arguments');
  });

  test('missing value arg returns validation error', async () => {
    const raw = await nsSet(['companyname'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('Missing arguments');
  });

  test('dialogs array is present in result data', async () => {
    const raw = await nsSet(['companyname', 'Test'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(Array.isArray(result.data.dialogs)).toBe(true);
  });
});
