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
  test('verify --current with matching values returns verified: true', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const raw = await nsVerify(['--current', 'companyname=Acme Corp', 'total=1500.00'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.verified).toBe(true);
    expect(result.data.mismatches).toBeArrayOfSize(0);
    expect(result.data.matched).toBeArrayOfSize(2);
    expect(result.data.record.fieldCount).toBe(5);
  });

  test('verify --current matches on displayValue as well', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    // total displayValue is '$1,500.00', value is '1500.00'
    const raw = await nsVerify(['--current', 'total=$1,500.00'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.verified).toBe(true);
    expect(result.data.matched).toBeArrayOfSize(1);
    expect(result.data.matched[0].field).toBe('total');
  });

  test('verify --current with mismatched values returns verified: false with mismatches', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const raw = await nsVerify(['--current', 'companyname=Wrong Name', 'total=9999.00'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.verified).toBe(false);
    expect(result.data.mismatches).toBeArrayOfSize(2);
    expect(result.data.matched).toBeArrayOfSize(0);

    // Check mismatch structure
    const companyMismatch = result.data.mismatches.find((m: any) => m.field === 'companyname');
    expect(companyMismatch).toBeDefined();
    expect(companyMismatch.expected).toBe('Wrong Name');
    expect(companyMismatch.actual.value).toBe('Acme Corp');
    expect(companyMismatch.actual.displayValue).toBe('Acme Corp');

    const totalMismatch = result.data.mismatches.find((m: any) => m.field === 'total');
    expect(totalMismatch).toBeDefined();
    expect(totalMismatch.expected).toBe('9999.00');
    expect(totalMismatch.actual.value).toBe('1500.00');
  });

  test('verify with no args returns error', async () => {
    const raw = await nsVerify([], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('Missing arguments');
  });

  test('verify with no field=value expectations returns error', async () => {
    const raw = await nsVerify(['--current'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('No field=value expectations');
  });

  test('verify on non-NS page returns NotARecordPage', async () => {
    const page = bm.getPage();
    await page.goto('about:blank');

    const raw = await nsVerify(['--current', 'companyname=Acme Corp'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('NotARecordPage');

    // Navigate back for subsequent tests
    await page.goto(baseUrl + '/ns-form.html');
  });

  test('mismatches include field, expected, and actual values', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const raw = await nsVerify(['--current', 'salesrep=999'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.verified).toBe(false);
    expect(result.data.mismatches).toBeArrayOfSize(1);

    const mismatch = result.data.mismatches[0];
    expect(mismatch.field).toBe('salesrep');
    expect(mismatch.expected).toBe('999');
    expect(mismatch.actual).toHaveProperty('value');
    expect(mismatch.actual).toHaveProperty('displayValue');
    expect(mismatch.actual.value).toBe('42');
    expect(mismatch.actual.displayValue).toBe('Jane Smith');
  });

  test('verify nonexistent field returns mismatch with null actuals', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const raw = await nsVerify(['--current', 'nonexistent_field=foo'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.verified).toBe(false);
    expect(result.data.mismatches).toBeArrayOfSize(1);
    expect(result.data.mismatches[0].actual.value).toBeNull();
    expect(result.data.mismatches[0].actual.displayValue).toBeNull();
  });

  test('verify mix of matching and mismatching fields', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const raw = await nsVerify(['--current', 'companyname=Acme Corp', 'total=9999.00'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.verified).toBe(false);
    expect(result.data.matched).toBeArrayOfSize(1);
    expect(result.data.matched[0].field).toBe('companyname');
    expect(result.data.mismatches).toBeArrayOfSize(1);
    expect(result.data.mismatches[0].field).toBe('total');
  });
});
