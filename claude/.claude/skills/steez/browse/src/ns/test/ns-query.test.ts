/**
 * Unit tests for ns query command.
 *
 * Spins up a test server that serves both the NS form fixture and a mock
 * SuiteQL REST endpoint at /services/rest/query/v1/suiteql.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { BrowserManager } from '../../core/browser-manager';
import { nsQuery } from '../commands/ns-query';
import * as path from 'path';
import * as fs from 'fs';

// ─── Test server with SuiteQL mock ─────────────────────────

const FIXTURES_DIR = path.resolve(import.meta.dir, 'fixtures');

/** Mock SuiteQL response data keyed by query pattern. */
const MOCK_RESULTS = {
  default: {
    items: [
      { id: 1, companyname: 'Acme Corp' },
      { id: 2, companyname: 'Globex Inc' },
      { id: 3, companyname: 'Initech' },
    ],
    totalResults: 3,
    hasMore: false,
  },
};

function startQueryTestServer(port: number = 0) {
  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',
    async fetch(req) {
      const url = new URL(req.url);

      // ── SuiteQL REST endpoint ─────────────────────────────
      if (req.method === 'POST' && url.pathname === '/services/rest/query/v1/suiteql') {
        const body = await req.json() as { q?: string };
        const sql = body.q ?? '';

        // Simulate error for queries containing ERROR_TRIGGER
        if (sql.includes('ERROR_TRIGGER')) {
          return new Response(
            JSON.stringify({
              'o:errorCode': 'INVALID_SEARCH',
              'o:errorDetails': [{ detail: 'Invalid search: field not found', code: 'INVALID_SEARCH' }],
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(JSON.stringify(MOCK_RESULTS.default), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // ── Static fixture files ──────────────────────────────
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

let testServer: ReturnType<typeof startQueryTestServer>;
let bm: BrowserManager;
let baseUrl: string;

beforeAll(async () => {
  testServer = startQueryTestServer(0);
  baseUrl = testServer.url;
  bm = new BrowserManager();
  await bm.launch();
  // Navigate to the NS form stub (provides nlapiGetField for guardNsApi)
  await bm.getPage().goto(baseUrl + '/ns-form.html');
});

afterAll(() => {
  try { testServer.server.stop(); } catch {}
  setTimeout(() => process.exit(0), 500);
});

// ─── Security: reject non-SELECT statements ────────────────

describe('ns query — security', () => {
  test('rejects empty query', async () => {
    const raw = await nsQuery([], bm);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('Empty query');
  });

  test('rejects INSERT statement', async () => {
    const raw = await nsQuery(['INSERT', 'INTO', 'customer', 'VALUES', '(1)'], bm);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('forbidden keyword');
  });

  test('rejects UPDATE statement', async () => {
    const raw = await nsQuery(['UPDATE', 'customer', 'SET', 'companyname', '=', "'x'"], bm);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(false);
    expect(result.error.message).toContain('forbidden keyword');
  });

  test('rejects DELETE statement', async () => {
    const raw = await nsQuery(['DELETE', 'FROM', 'customer'], bm);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(false);
    expect(result.error.message).toContain('forbidden keyword');
  });

  test('rejects DROP statement', async () => {
    const raw = await nsQuery(['DROP', 'TABLE', 'customer'], bm);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(false);
    expect(result.error.message).toContain('forbidden keyword');
  });

  test('rejects TRUNCATE statement', async () => {
    const raw = await nsQuery(['TRUNCATE', 'TABLE', 'customer'], bm);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(false);
    expect(result.error.message).toContain('forbidden keyword');
  });

  test('rejects ALTER statement', async () => {
    const raw = await nsQuery(['ALTER', 'TABLE', 'customer', 'ADD', 'col'], bm);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(false);
    expect(result.error.message).toContain('forbidden keyword');
  });

  test('rejects CREATE statement', async () => {
    const raw = await nsQuery(['CREATE', 'TABLE', 'foo', '(id int)'], bm);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(false);
    expect(result.error.message).toContain('forbidden keyword');
  });

  test('rejects query not starting with SELECT', async () => {
    const raw = await nsQuery(['WITH', 'cte', 'AS', '(SELECT 1)'], bm);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(false);
    expect(result.error.message).toContain('must start with SELECT');
  });
});

// ─── Successful query execution ────────────────────────────

describe('ns query — execution', () => {
  test('executes a SELECT query and returns rows', async () => {
    const raw = await nsQuery(['SELECT', 'id,', 'companyname', 'FROM', 'customer', 'WHERE', 'id', '<', '100'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(true);
    expect(result.data.query).toBe('SELECT id, companyname FROM customer WHERE id < 100');
    expect(result.data.rowCount).toBe(3);
    expect(result.data.rows).toHaveLength(3);
    expect(result.data.rows[0]).toEqual({ id: 1, companyname: 'Acme Corp' });
    expect(result.data.truncated).toBe(false);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  test('joins args into a single query string', async () => {
    const raw = await nsQuery(['SELECT', '1'], bm);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(true);
    expect(result.data.query).toBe('SELECT 1');
  });

  test('handles query error response from server', async () => {
    const raw = await nsQuery(['SELECT', 'ERROR_TRIGGER', 'FROM', 'customer'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('SuiteQL error');
  });
});

// ─── guardNsApi gating ─────────────────────────────────────

describe('ns query — guardNsApi', () => {
  test('fails on a page without NS API', async () => {
    const page = bm.getPage();
    await page.goto('about:blank');

    const raw = await nsQuery(['SELECT', '1'], bm);
    const result = JSON.parse(raw);

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('NotARecordPage');

    // Navigate back for other tests
    await page.goto(baseUrl + '/ns-form.html');
  });
});
