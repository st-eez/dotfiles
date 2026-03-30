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
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');
  });

  test('set text field suppresses cascading', async () => {
    const output = await nsSet(['companyname', 'New Company'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('SET OK');
    expect(output.display).toContain('companyname');
    expect(output.display).toContain('New Company');
    expect(output.display).toContain('Cascading: suppressed');
    expect(output.display).toContain('Settled: yes');

    // Verify value was actually set
    const page = bm.getPage();
    const actual = await page.evaluate(() => (window as any).nlapiGetFieldValue('companyname'));
    expect(actual).toBe('New Company');
  });

  test('set entity-ref field auto-detects and fires cascading', async () => {
    const output = await nsSet(['salesrep', '99'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('SET OK');
    expect(output.display).toContain('salesrep');
    expect(output.display).toContain('Cascading: fired');

    // The mock sourcing cascade should have updated companyname
    const page = bm.getPage();
    const companyValue = await page.evaluate(() => (window as any).nlapiGetFieldValue('companyname'));
    expect(companyValue).toBe('Sourced Company');

    // Diff should show the cascaded change
    expect(output.display).toContain('Changed: companyname');
    expect(output.display).toContain('Acme Corp');
    expect(output.display).toContain('Sourced Company');
  });

  test('--source flag forces cascading on text field', async () => {
    const output = await nsSet(['companyname', 'Forced', '--source'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('Cascading: fired');
  });

  test('--no-source flag suppresses cascading on entity-ref field', async () => {
    const output = await nsSet(['salesrep', '99', '--no-source'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('Cascading: suppressed');
    // With cascading suppressed, no Changed lines
    expect(output.display).not.toContain('Changed:');
  });

  test('set nonexistent field returns error', async () => {
    const output = await nsSet(['nonexistent', 'value'], bm);

    expect(output.ok).toBe(false);
    expect(output.display).toContain('ns set failed');
    expect(output.display).toContain('nonexistent');
    expect(output.display).toContain('not found');
  });

  test('set on non-NS page returns error', async () => {
    const page = bm.getPage();
    await page.goto('about:blank');

    const output = await nsSet(['companyname', 'test'], bm);

    expect(output.ok).toBe(false);
    expect(output.display).toContain('NotARecordPage');
  });

  test('missing args returns error', async () => {
    const output = await nsSet([], bm);

    expect(output.ok).toBe(false);
    expect(output.display).toContain('Missing arguments');
  });

  test('missing value arg returns error', async () => {
    const output = await nsSet(['companyname'], bm);

    expect(output.ok).toBe(false);
    expect(output.display).toContain('Missing arguments');
  });

  test('successful set has no Dialog line when empty', async () => {
    const output = await nsSet(['companyname', 'Test'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).not.toContain('Dialog');
  });
});
