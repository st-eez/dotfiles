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
      const pathname = url.pathname;

      let filePath: string;
      if (
        pathname.startsWith('/app/accounting/transactions/') ||
        pathname.startsWith('/app/common/entity/') ||
        pathname.startsWith('/app/common/custom/')
      ) {
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
  test('navigates to new salesorder', async () => {
    const output = await nsNavigate(['salesorder'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('NAVIGATE OK');
    expect(output.display).toContain('salesorder');
    expect(output.display).toContain('create');
    expect(output.display).toContain('salesord.nl');
    expect(output.metadata?.recordType).toBe('salesorder');
  });

  test('navigates to new customer', async () => {
    const output = await nsNavigate(['customer'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('NAVIGATE OK');
    expect(output.display).toContain('customer');
    expect(output.display).toContain('custjob.nl');
  });
});

// ─── Navigate to existing record ──────────────────────────────

describe('ns navigate — existing record', () => {
  test('navigates with --id flag (view mode)', async () => {
    const output = await nsNavigate(['salesorder', '--id', '12345'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('salesorder');
    expect(output.display).toContain('view');
    expect(output.display).toContain('id=12345');
    expect(output.metadata?.recordId).toBe('12345');
  });

  test('navigates with --id and --edit flags', async () => {
    const output = await nsNavigate(['salesorder', '--id', '12345', '--edit'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('salesorder');
    expect(output.display).toContain('edit');
    expect(output.display).toContain('id=12345');
    expect(output.display).toContain('e=T');
  });
});

// ─── Error cases ──────────────────────────────────────────────

describe('ns navigate — errors', () => {
  test('missing record type returns error', async () => {
    const output = await nsNavigate([], bm);

    expect(output.ok).toBe(false);
    expect(output.display).toContain('ns navigate failed');
    expect(output.display).toContain('Missing record type');
  });
});

// ─── Custom record fallback ───────────────────────────────────

describe('ns navigate — custom records', () => {
  test('unknown record type falls back to custom record URL', async () => {
    const output = await nsNavigate(['mywidget'], bm);

    expect(output.ok).toBe(true);
    expect(output.display).toContain('NAVIGATE OK');
    expect(output.display).toContain('mywidget');
    expect(output.display).toContain('custrecordmywidget.nl');
  });
});
