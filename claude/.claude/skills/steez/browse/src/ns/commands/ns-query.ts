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
import { guardNsApi, nsOk, nsFail, validationError, notARecordPage } from '../errors';
import { withMutex, nsMutex } from '../mutex';

const MAX_ROWS = 200;

/** Statements that must never reach the SuiteQL endpoint. */
const FORBIDDEN_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|MERGE|EXEC|EXECUTE|GRANT|REVOKE)\b/i;

export async function nsQuery(args: string[], bm: BrowserManager): Promise<string> {
  return withMutex(nsMutex, async () => {
    const start = Date.now();

    // ── Build query string ────────────────────────────────────
    const sql = args.join(' ').trim();
    if (!sql) {
      return JSON.stringify(nsFail(validationError('Empty query. Usage: ns query "SELECT ..."'), Date.now() - start));
    }

    // ── Security gate: SELECT only ────────────────────────────
    if (FORBIDDEN_KEYWORDS.test(sql)) {
      return JSON.stringify(
        nsFail(
          validationError(`Only SELECT queries are allowed. Detected forbidden keyword in: ${sql}`),
          Date.now() - start,
        ),
      );
    }

    if (!/^\s*SELECT\b/i.test(sql)) {
      return JSON.stringify(
        nsFail(
          validationError(`Query must start with SELECT. Got: ${sql.slice(0, 40)}...`),
          Date.now() - start,
        ),
      );
    }

    // ── NS API guard ──────────────────────────────────────────
    const target = bm.getActiveFrameOrPage();
    const apiErr = await guardNsApi(target);
    if (apiErr) {
      return JSON.stringify(nsFail(apiErr, Date.now() - start));
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

    const elapsed = Date.now() - start;

    // ── Error response ────────────────────────────────────────
    if (response.error) {
      return JSON.stringify(
        nsFail(
          validationError(`SuiteQL error: ${response.error}`),
          elapsed,
        ),
      );
    }

    // ── Success response ──────────────────────────────────────
    const allRows = response.items ?? [];
    const truncated = allRows.length > MAX_ROWS;
    const rows = truncated ? allRows.slice(0, MAX_ROWS) : allRows;

    return JSON.stringify(
      nsOk(
        {
          query: sql,
          rowCount: rows.length,
          rows,
          truncated,
          ...(truncated ? { note: `Results limited to ${MAX_ROWS} rows. Refine your query for complete data.` } : {}),
        },
        elapsed,
      ),
    );
  }, { label: 'ns query' });
}
