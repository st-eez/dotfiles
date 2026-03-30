/**
 * ns query — Execute SuiteQL queries against the NetSuite REST API.
 *
 * Usage: ns query "SELECT id, companyname FROM customer WHERE id < 100"
 *
 * Security: Only SELECT statements are allowed. INSERT/UPDATE/DELETE/DROP/
 * TRUNCATE/ALTER/CREATE are rejected before any network call.
 *
 * Implementation: Uses the authenticated session cookie already present on
 * the page to POST to /services/rest/query/v1/suiteql. Results are capped
 * at 200 rows with a truncation flag.
 */

import type { BrowserManager } from '../../core/browser-manager';
import type { NsCommandOutput } from '../format';
import { formatNsError } from '../format';
import { guardNsApi, validationError } from '../errors';
import { withMutex, nsMutex } from '../mutex';

const MAX_ROWS = 200;

/** Statements that must never reach the SuiteQL endpoint. */
const FORBIDDEN_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|MERGE|EXEC|EXECUTE|GRANT|REVOKE)\b/i;

export async function nsQuery(args: string[], bm: BrowserManager): Promise<NsCommandOutput> {
  const start = Date.now();

  // ── Build query string ────────────────────────────────────
  const sql = args.join(' ').trim();
  if (!sql) {
    return { display: formatNsError('ns query', validationError('Empty query. Usage: ns query "SELECT ..."')), ok: false };
  }

  // ── Security gate: SELECT only ────────────────────────────
  if (FORBIDDEN_KEYWORDS.test(sql)) {
    return { display: formatNsError('ns query', validationError(`Only SELECT queries are allowed. Detected forbidden keyword in: ${sql}`)), ok: false };
  }

  if (!/^\s*SELECT\b/i.test(sql)) {
    return { display: formatNsError('ns query', validationError(`Query must start with SELECT. Got: ${sql.slice(0, 40)}...`)), ok: false };
  }

  type QueryResult =
    | { ok: true; rows: Record<string, unknown>[]; truncated: boolean }
    | { ok: false; error: string };

  const queryResult = await withMutex(nsMutex, async (): Promise<QueryResult> => {
    // ── NS API guard ──────────────────────────────────────────
    const target = bm.getActiveFrameOrPage();
    const apiErr = await guardNsApi(target);
    if (apiErr) {
      return { ok: false, error: formatNsError('ns query', apiErr) };
    }

    // ── Execute via fetch on the page (uses session cookie) ───
    const page = bm.getPage();

    interface SuiteQLResponse {
      error?: string;
      status?: number;
      items?: Record<string, unknown>[];
      totalResults?: number;
      hasMore?: boolean;
    }

    const response: SuiteQLResponse = await page.evaluate(
      async ({ sql, limit }: { sql: string; limit: number }) => {
        try {
          const res = await fetch('/services/rest/query/v1/suiteql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Prefer': 'transient',
            },
            body: JSON.stringify({ q: /\bFETCH\s+FIRST\b/i.test(sql) ? sql : sql + ` FETCH FIRST ${limit + 1} ROWS ONLY` }),
          });

          if (!res.ok) {
            const text = await res.text().catch(() => '');
            return { error: text || res.statusText, status: res.status };
          }

          const data = await res.json();
          return {
            items: data.items ?? [],
            totalResults: data.totalResults ?? data.count ?? 0,
            hasMore: data.hasMore ?? false,
          };
        } catch (err: any) {
          return { error: err?.message ?? String(err) };
        }
      },
      { sql, limit: MAX_ROWS },
    );

    if (response.error) {
      return { ok: false, error: formatNsError('ns query', validationError(`SuiteQL error: ${response.error}`)) };
    }

    const allRows = response.items ?? [];
    const truncated = allRows.length > MAX_ROWS;
    const rows = truncated ? allRows.slice(0, MAX_ROWS) : allRows;

    return { ok: true, rows, truncated };
  }, { label: 'ns query' });

  // ── Format output ──────────────────────────────────────────
  if (!queryResult.ok) {
    return { display: queryResult.error, ok: false };
  }

  const { rows, truncated } = queryResult;
  const header = truncated
    ? `QUERY OK | Rows: ${rows.length} shown of ${rows.length}+ total`
    : `QUERY OK | Rows: ${rows.length}`;

  // Strip links:[] noise and emit NDJSON
  const ndjsonLines = rows.map(row => {
    const cleaned = Object.fromEntries(
      Object.entries(row).filter(([k]) => k !== 'links'),
    );
    return JSON.stringify(cleaned);
  });

  return {
    display: [header, ...ndjsonLines].join('\n'),
    ok: true,
  };
}
