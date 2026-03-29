/**
 * Tests for ns inspect command.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { BrowserManager } from '../../core/browser-manager';
import { nsInspect } from '../commands/ns-inspect';
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

// ─── ns inspect ───────────────────────────────────────────

describe('ns inspect', () => {
  test('inspect all fields returns 5 fields with correct metadata shape', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const raw = await nsInspect([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.fields).toBeArrayOfSize(5);
    expect(typeof result.elapsedMs).toBe('number');

    // Check metadata shape on each field
    for (const field of result.data.fields) {
      expect(typeof field.id).toBe('string');
      expect(typeof field.label).toBe('string');
      expect(typeof field.type).toBe('string');
      expect(typeof field.mandatory).toBe('boolean');
      expect(typeof field.disabled).toBe('boolean');
      expect(typeof field.isEntityRef).toBe('boolean');
      // value and displayValue can be string or null
      expect(field.value === null || typeof field.value === 'string').toBe(true);
      expect(field.displayValue === null || typeof field.displayValue === 'string').toBe(true);
    }
  });

  test('inspect with --field returns single field', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const raw = await nsInspect(['--field', 'companyname'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.fields).toBeArrayOfSize(1);
    expect(result.data.fields[0].id).toBe('companyname');
    expect(result.data.fields[0].label).toBe('Company Name');
    expect(result.data.fields[0].type).toBe('text');
    expect(result.data.fields[0].value).toBe('Acme Corp');
  });

  test('inspect with --field for nonexistent field returns empty array', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const raw = await nsInspect(['--field', 'nonexistent_field_xyz'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.fields).toBeArrayOfSize(0);
  });

  test('inspect returns form mode', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const raw = await nsInspect([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.mode).toBe('create');

    // Edit mode
    await page.goto(baseUrl + '/ns-form.html?id=123&e=T');
    const rawEdit = await nsInspect([], bm);
    const resultEdit = JSON.parse(rawEdit);

    expect(resultEdit.ok).toBe(true);
    expect(resultEdit.data.mode).toBe('edit');

    // Navigate back
    await page.goto(baseUrl + '/ns-form.html');
  });

  test('inspect with --sublists discovers sublists from DOM', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const raw = await nsInspect(['--sublists'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.sublists).toBeDefined();
    expect(Array.isArray(result.data.sublists)).toBe(true);
    expect(result.data.sublists.length).toBeGreaterThanOrEqual(1);

    // Find the 'item' sublist
    const itemSublist = result.data.sublists.find((s: any) => s.id === 'item');
    expect(itemSublist).toBeDefined();

    // Column headers
    expect(itemSublist.columns).toBeArrayOfSize(4);
    const labels = itemSublist.columns.map((c: any) => c.label);
    expect(labels).toContain('Item');
    expect(labels).toContain('Quantity');
    expect(labels).toContain('Rate');
    expect(labels).toContain('Amount');

    // Line count and values
    expect(itemSublist.lineCount).toBe(2);
    expect(itemSublist.lines).toBeArrayOfSize(2);
    expect(itemSublist.lines[0].line).toBe(1);
    expect(itemSublist.lines[0].values.item).toBe('100');
    expect(itemSublist.lines[0].values.quantity).toBe('5');
    expect(itemSublist.lines[1].line).toBe(2);
    expect(itemSublist.lines[1].values.item).toBe('200');
  });

  test('inspect on non-NS page returns NotARecordPage error', async () => {
    const page = bm.getPage();
    await page.goto('about:blank');

    const raw = await nsInspect([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('NotARecordPage');

    // Navigate back for subsequent tests
    await page.goto(baseUrl + '/ns-form.html');
  });

  test('inspect without --sublists does not include sublists key', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const raw = await nsInspect([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.sublists).toBeUndefined();
  });
});
