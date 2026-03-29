/**
 * Tests for ns diff command.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { BrowserManager } from '../../core/browser-manager';
import { nsDiff } from '../commands/ns-diff';
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

// ─── ns diff ───────────────────────────────────────────────

describe('ns diff', () => {
  beforeEach(async () => {
    // Reset to a fresh page before each test
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');
  });

  test('diff with no args returns baseline snapshot (no changes)', async () => {
    const raw = await nsDiff([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.action).toBeNull();
    expect(result.data.changed).toEqual([]);
    expect(result.data.unchanged).toBeGreaterThan(0);
    expect(typeof result.elapsedMs).toBe('number');

    // before and after should be identical
    expect(result.data.before).toEqual(result.data.after);

    // Verify snapshot shape — each field has value + displayValue
    const companyname = result.data.before['companyname'];
    expect(companyname).toBeDefined();
    expect(companyname.value).toBe('Acme Corp');
    expect(companyname.displayValue).toBe('Acme Corp');
  });

  test('diff set companyname shows companyname changed', async () => {
    const raw = await nsDiff(['set', 'companyname', 'New Name'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.action).toBe('set companyname New Name');
    expect(result.data.changed.length).toBeGreaterThanOrEqual(1);

    // companyname should appear in changes
    const companyChange = result.data.changed.find((c: any) => c.id === 'companyname');
    expect(companyChange).toBeDefined();
    expect(companyChange.before.value).toBe('Acme Corp');
    expect(companyChange.after.value).toBe('New Name');

    // before and after maps should reflect the change
    expect(result.data.before['companyname'].value).toBe('Acme Corp');
    expect(result.data.after['companyname'].value).toBe('New Name');
  });

  test('diff set salesrep shows cascading changes', async () => {
    const raw = await nsDiff(['set', 'salesrep', '99'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.action).toBe('set salesrep 99');

    // salesrep itself should have changed
    const salesrepChange = result.data.changed.find((c: any) => c.id === 'salesrep');
    expect(salesrepChange).toBeDefined();
    expect(salesrepChange.before.value).toBe('42');
    expect(salesrepChange.after.value).toBe('99');

    // The mock cascading should also change companyname (sourcing simulation)
    const companyChange = result.data.changed.find((c: any) => c.id === 'companyname');
    expect(companyChange).toBeDefined();
    expect(companyChange.before.value).toBe('Acme Corp');
    expect(companyChange.after.value).toBe('Sourced Company');

    // At least 2 fields changed (salesrep + companyname)
    expect(result.data.changed.length).toBeGreaterThanOrEqual(2);
  });

  test('diff on non-NS page returns NotARecordPage', async () => {
    const page = bm.getPage();
    await page.goto('about:blank');

    const raw = await nsDiff([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('NotARecordPage');
  });

  test('result includes before/after/changed structure', async () => {
    const raw = await nsDiff(['set', 'companyname', 'Test Co'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);

    // Top-level data keys
    expect(result.data).toHaveProperty('action');
    expect(result.data).toHaveProperty('before');
    expect(result.data).toHaveProperty('after');
    expect(result.data).toHaveProperty('changed');
    expect(result.data).toHaveProperty('unchanged');

    // before/after are Record<string, { value, displayValue }>
    expect(typeof result.data.before).toBe('object');
    expect(typeof result.data.after).toBe('object');

    // changed is an array of { id, before: { value, displayValue }, after: { value, displayValue } }
    expect(Array.isArray(result.data.changed)).toBe(true);
    for (const change of result.data.changed) {
      expect(typeof change.id).toBe('string');
      expect(change.before).toHaveProperty('value');
      expect(change.before).toHaveProperty('displayValue');
      expect(change.after).toHaveProperty('value');
      expect(change.after).toHaveProperty('displayValue');
    }

    // unchanged is a number
    expect(typeof result.data.unchanged).toBe('number');
  });

  test('diff set nonexistent field returns validation error', async () => {
    const raw = await nsDiff(['set', 'nonexistent', 'value'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('nonexistent');
    expect(result.error.message).toContain('not found');
  });

  test('diff set with missing value returns validation error', async () => {
    const raw = await nsDiff(['set', 'companyname'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('Missing arguments');
  });

  test('diff with unknown action returns validation error', async () => {
    const raw = await nsDiff(['delete', 'companyname'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('Unknown diff action');
    expect(result.error.message).toContain('delete');
  });
});
