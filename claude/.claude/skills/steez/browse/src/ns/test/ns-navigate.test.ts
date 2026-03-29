/**
 * Tests for ns navigate command.
 *
 * Uses a local test server serving NS form fixtures with mock nlapi stubs.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { BrowserManager } from '../../core/browser-manager';
import { nsNavigate } from '../commands/ns-navigate';
import * as path from 'path';
import * as fs from 'fs';

// ─── Test server (same pattern as utils.test.ts) ─────────────

const FIXTURES_DIR = path.resolve(import.meta.dir, 'fixtures');

function startNsTestServer(port: number = 0) {
  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',
    fetch(req) {
      const url = new URL(req.url);
      // Serve ns-form.html for any path that looks like an NS record URL
      // This simulates NetSuite serving the form at various URL patterns
      const pathname = url.pathname;

      let filePath: string;
      if (
        pathname.startsWith('/app/accounting/transactions/') ||
        pathname.startsWith('/app/common/entity/') ||
        pathname.startsWith('/app/common/custom/')
      ) {
        // Simulate NS record page — serve the mock form
        filePath = 'ns-form.html';
      } else if (pathname === '/' || pathname === '/ns-form.html') {
        filePath = 'ns-form.html';
      } else {
        filePath = pathname.replace(/^\//, '');
      }

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

let testServer: ReturnType<typeof startNsTestServer>;
let bm: BrowserManager;
let baseUrl: string;

beforeAll(async () => {
  testServer = startNsTestServer(0);
  baseUrl = testServer.url;
  bm = new BrowserManager();
  await bm.launch();
  // Start on the mock NS form so we have a valid origin
  await bm.getPage().goto(baseUrl + '/ns-form.html');
});

afterAll(() => {
  try { testServer.server.stop(); } catch {}
  setTimeout(() => process.exit(0), 500);
});

// ─── Navigate to new record ────────────────────────────────────

describe('ns navigate — new record', () => {
  test('navigates to new salesorder (URL contains salesord slug)', async () => {
    const result = JSON.parse(await nsNavigate(['salesorder'], bm));

    expect(result.ok).toBe(true);
    expect(result.data.recordType).toBe('salesorder');
    expect(result.data.url).toContain('/app/accounting/transactions/salesord.nl');
    expect(result.data.mode).toBe('create');
    expect(result.data.sessionValid).toBe(true);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  test('navigates to new customer (entity URL path)', async () => {
    const result = JSON.parse(await nsNavigate(['customer'], bm));

    expect(result.ok).toBe(true);
    expect(result.data.recordType).toBe('customer');
    expect(result.data.url).toContain('/app/common/entity/custjob.nl');
    expect(result.data.mode).toBe('create');
  });
});

// ─── Navigate to existing record ──────────────────────────────

describe('ns navigate — existing record', () => {
  test('navigates with --id flag (view mode)', async () => {
    const result = JSON.parse(await nsNavigate(['salesorder', '--id', '12345'], bm));

    expect(result.ok).toBe(true);
    expect(result.data.recordType).toBe('salesorder');
    expect(result.data.url).toContain('id=12345');
    expect(result.data.mode).toBe('view');
  });

  test('navigates with --id and --edit flags', async () => {
    const result = JSON.parse(await nsNavigate(['salesorder', '--id', '12345', '--edit'], bm));

    expect(result.ok).toBe(true);
    expect(result.data.recordType).toBe('salesorder');
    expect(result.data.url).toContain('id=12345');
    expect(result.data.url).toContain('e=T');
    expect(result.data.mode).toBe('edit');
  });
});

// ─── Error cases ──────────────────────────────────────────────

describe('ns navigate — errors', () => {
  test('missing record type returns validation error', async () => {
    const result = JSON.parse(await nsNavigate([], bm));

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('Missing record type');
  });
});

// ─── Custom record fallback ───────────────────────────────────

describe('ns navigate — custom records', () => {
  test('unknown record type falls back to custom record URL', async () => {
    const result = JSON.parse(await nsNavigate(['mywidget'], bm));

    expect(result.ok).toBe(true);
    expect(result.data.recordType).toBe('mywidget');
    expect(result.data.url).toContain('/app/common/custom/custrecordmywidget.nl');
  });
});
