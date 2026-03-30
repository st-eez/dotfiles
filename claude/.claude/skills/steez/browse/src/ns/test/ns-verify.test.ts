/**
 * Tests for ns verify command.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { BrowserManager } from '../../core/browser-manager';
import { nsVerify } from '../commands/ns-verify';
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

// ─── ns verify ──────────────────────────────────────────────

describe('ns verify', () => {
  test('verify --current with matching values returns VERIFY OK', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const output = await nsVerify(['--current', 'companyname=Acme Corp', 'total=1500.00'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('VERIFY OK');
    expect(output.display).toContain('Matched: companyname');
    expect(output.display).toContain('Matched: total');
    expect(output.display).not.toContain('Mismatch');
  });

  test('verify --current matches on displayValue as well', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    // total displayValue is '$1,500.00', value is '1500.00'
    const output = await nsVerify(['--current', 'total=$1,500.00'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('VERIFY OK');
    expect(output.display).toContain('Matched: total');
  });

  test('verify --current with mismatched values returns VERIFY FAILED', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const output = await nsVerify(['--current', 'companyname=Wrong Name', 'total=9999.00'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('VERIFY FAILED');
    expect(output.display).toContain('Mismatch: companyname');
    expect(output.display).toContain('Mismatch: total');
    expect(output.display).not.toContain('Matched:');
  });

  test('verify with no args returns error', async () => {
    const output = await nsVerify([], bm);

    expect(output.ok).toBe(false);
    expect(output.display).toContain('Missing arguments');
  });

  test('verify with no field=value expectations returns error', async () => {
    const output = await nsVerify(['--current'], bm);

    expect(output.ok).toBe(false);
    expect(output.display).toContain('No field=value expectations');
  });

  test('verify on non-NS page returns error', async () => {
    const page = bm.getPage();
    await page.goto('about:blank');

    const output = await nsVerify(['--current', 'companyname=Acme Corp'], bm);

    expect(output.ok).toBe(false);
    expect(output.display).toContain('NotARecordPage');

    await page.goto(baseUrl + '/ns-form.html');
  });

  test('mismatch shows expected and actual values', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const output = await nsVerify(['--current', 'salesrep=999'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('VERIFY FAILED');
    expect(output.display).toContain('Mismatch: salesrep');
    expect(output.display).toContain('expected');
    expect(output.display).toContain('999');
    expect(output.display).toContain('actual');
    expect(output.display).toContain('42');
  });

  test('verify nonexistent field shows mismatch with null', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const output = await nsVerify(['--current', 'nonexistent_field=foo'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('VERIFY FAILED');
    expect(output.display).toContain('Mismatch: nonexistent_field');
    expect(output.display).toContain('(null)');
  });

  test('verify mix of matching and mismatching fields', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const output = await nsVerify(['--current', 'companyname=Acme Corp', 'total=9999.00'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('VERIFY FAILED');
    expect(output.display).toContain('Matched: companyname');
    expect(output.display).toContain('Mismatch: total');
  });
});
