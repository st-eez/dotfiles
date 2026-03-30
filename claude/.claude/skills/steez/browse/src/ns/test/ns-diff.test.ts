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
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');
  });

  test('diff with no args returns baseline snapshot (no changes)', async () => {
    const output = await nsDiff([], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('DIFF OK');
    expect(output.display).toContain('Baseline snapshot');
    expect(output.display).toContain('0 changed');
    // Should not have any Changed: lines
    expect(output.display).not.toContain('Changed:');
  });

  test('diff set companyname shows companyname changed', async () => {
    const output = await nsDiff(['set', 'companyname', 'New Name'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('DIFF OK');
    expect(output.display).toContain('Action: set companyname New Name');
    expect(output.display).toContain('Changed: companyname');
    expect(output.display).toContain('Acme Corp');
    expect(output.display).toContain('New Name');
  });

  test('diff set salesrep shows cascading changes', async () => {
    const output = await nsDiff(['set', 'salesrep', '99'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('Action: set salesrep 99');

    // salesrep itself should appear in Changed lines
    expect(output.display).toContain('Changed: salesrep');

    // The mock cascading should also change companyname
    expect(output.display).toContain('Changed: companyname');
    expect(output.display).toContain('Sourced Company');
  });

  test('diff on non-NS page returns error', async () => {
    const page = bm.getPage();
    await page.goto('about:blank');

    const output = await nsDiff([], bm);

    expect(output.ok).toBe(false);
    expect(output.display).toContain('NotARecordPage');
  });

  test('diff set nonexistent field returns error', async () => {
    const output = await nsDiff(['set', 'nonexistent', 'value'], bm);

    expect(output.ok).toBe(false);
    expect(output.display).toContain('nonexistent');
    expect(output.display).toContain('not found');
  });

  test('diff set with missing value returns error', async () => {
    const output = await nsDiff(['set', 'companyname'], bm);

    expect(output.ok).toBe(false);
    expect(output.display).toContain('Missing arguments');
  });

  test('diff with unknown action returns error', async () => {
    const output = await nsDiff(['delete', 'companyname'], bm);

    expect(output.ok).toBe(false);
    expect(output.display).toContain('Unknown diff action');
    expect(output.display).toContain('delete');
  });
});
