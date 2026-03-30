/**
 * ns inspect — Full form graph inspection.
 *
 * Usage:
 *   ns inspect                    → inspect all fields + form mode
 *   ns inspect --field companyname → inspect single field
 *   ns inspect --sublists         → include sublist discovery from DOM
 *
 * Introspects fields via nlapiGetField / nlapiGetFieldValue / nlapiGetFieldText,
 * detects form mode from URL, and optionally discovers sublists from the DOM
 * (table headers, line counts, line values).
 */

import type { BrowserManager } from '../../core/browser-manager';
import type { NsCommandOutput } from '../format';
import { formatNsError, truncateValue } from '../format';
import type { NsCommandResult } from '../errors';
import type { NsFieldMetadata, NsFormMode } from '../utils/introspect-field';
import { guardNsApi, nsOk, nsFail, notARecordPage } from '../errors';
import { introspectField, introspectAllFields, detectFormMode } from '../utils/introspect-field';
import { withMutex, nsMutex } from '../mutex';

// ─── Types ──────────────────────────────────────────────────

export interface NsSublistColumn {
  id: string;
  label: string;
}

export interface NsSublistLine {
  line: number;
  values: Record<string, string>;
}

export interface NsSublistData {
  id: string;
  columns: NsSublistColumn[];
  lineCount: number;
  lines: NsSublistLine[];
}

export interface NsInspectData {
  mode: NsFormMode;
  fields: NsFieldMetadata[];
  sublists?: NsSublistData[];
}

// ─── Arg Parsing ────────────────────────────────────────────

function parseInspectArgs(args: string[]): { fieldId: string | null; sublists: boolean } {
  let fieldId: string | null = null;
  let sublists = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--field') {
      fieldId = args[++i] ?? null;
    } else if (arg === '--sublists') {
      sublists = true;
    }
  }

  return { fieldId, sublists };
}

// ─── ns inspect ─────────────────────────────────────────────

export async function nsInspect(args: string[], bm: BrowserManager): Promise<NsCommandOutput> {
  const result = await withMutex(nsMutex, async (): Promise<NsCommandResult<NsInspectData>> => {
    const start = Date.now();
    const target = bm.getActiveFrameOrPage();

    // Guard: must be on a NS page with client API
    const guardErr = await guardNsApi(target);
    if (guardErr) {
      return nsFail(guardErr, Date.now() - start);
    }

    const { fieldId, sublists: includeSublists } = parseInspectArgs(args);

    // Detect form mode
    const mode = await detectFormMode(target);

    // Introspect fields
    let fields: NsFieldMetadata[];
    if (fieldId) {
      const single = await introspectField(target, fieldId);
      fields = single ? [single] : [];
    } else {
      fields = await introspectAllFields(target);
    }

    // Optionally discover sublists from DOM
    let sublists: NsSublistData[] | undefined;
    if (includeSublists) {
      sublists = await discoverSublists(bm);
    }

    const data: NsInspectData = {
      mode,
      fields,
      ...(sublists ? { sublists } : {}),
    };

    return nsOk<NsInspectData>(data, Date.now() - start);
  }, { label: 'ns inspect', operationTimeoutMs: 10000 });

  if (!result.ok) {
    return { display: formatNsError('ns inspect', result.error!), ok: false };
  }

  const d = result.data!;
  const lines = [`INSPECT OK | Mode: ${d.mode} | ${d.fields.length} fields`];

  for (const f of d.fields) {
    const flags: string[] = [];
    if (f.mandatory) flags.push('mandatory');
    if (f.disabled) flags.push('disabled');
    if (f.isEntityRef) flags.push('entityRef');
    lines.push(`${f.id} | ${truncateValue(f.value)} | ${f.type} | ${flags.join(',') || '-'}`);
  }

  if (d.sublists) {
    for (const sub of d.sublists) {
      lines.push(`Sublist: ${sub.id} (${sub.lineCount} lines, ${sub.columns.length} columns)`);
      for (const line of sub.lines) {
        const vals = sub.columns.map(c => `${c.id}=${truncateValue(line.values[c.id])}`).join(', ');
        lines.push(`  ${line.line}: ${vals}`);
      }
    }
  }

  return { display: lines.join('\n'), ok: true };
}

// ─── Sublist Discovery ──────────────────────────────────────

/**
 * Discover sublists from the DOM by finding sublist containers
 * (div[id$="_splits"], table.uir-machine-table), extract column
 * headers, then read line values via nlapi sublist APIs.
 */
async function discoverSublists(bm: BrowserManager): Promise<NsSublistData[]> {
  const page = bm.getPage();

  // Step 1: Discover sublist IDs and their column headers from the DOM
  const discovered = await page.evaluate(() => {
    const results: Array<{
      id: string;
      columns: Array<{ id: string; label: string }>;
    }> = [];

    const seen = new Set<string>();

    // Strategy A: div[id$="_splits"] containers (e.g. "item_splits" → sublist "item")
    const splitDivs = document.querySelectorAll('div[id$="_splits"]');
    for (const div of splitDivs) {
      const sublistId = div.id.replace(/_splits$/, '');
      if (seen.has(sublistId)) continue;
      seen.add(sublistId);

      // Extract column headers from the table inside the splits container
      const columns: Array<{ id: string; label: string }> = [];
      const headerCells = div.querySelectorAll('thead tr td.listheadertd, thead tr th.listheadertd');
      for (const cell of headerCells) {
        const headerDiv = cell.querySelector('.listheadertextb, .listheadertext');
        const label = headerDiv?.textContent?.trim() ?? cell.textContent?.trim() ?? '';
        if (label) {
          // Derive column ID from label (lowercase, no spaces) as best-effort
          const id = label.toLowerCase().replace(/[^a-z0-9]/g, '');
          columns.push({ id, label });
        }
      }

      results.push({ id: sublistId, columns });
    }

    // Strategy B: table.uir-machine-table not inside a _splits div
    const machineTables = document.querySelectorAll('table.uir-machine-table');
    for (const table of machineTables) {
      // Check if this table is already inside a discovered _splits container
      const parentSplits = table.closest('div[id$="_splits"]');
      if (parentSplits) continue; // Already discovered above

      // Try to derive a sublist ID from the table's parent or id
      const tableId = table.id || table.closest('[id]')?.id || '';
      const sublistId = tableId.replace(/_[a-z]+$/, '') || `unknown_${seen.size}`;
      if (seen.has(sublistId)) continue;
      seen.add(sublistId);

      const columns: Array<{ id: string; label: string }> = [];
      const headerCells = table.querySelectorAll('thead tr td.listheadertd, thead tr th.listheadertd');
      for (const cell of headerCells) {
        const headerDiv = cell.querySelector('.listheadertextb, .listheadertext');
        const label = headerDiv?.textContent?.trim() ?? cell.textContent?.trim() ?? '';
        if (label) {
          const id = label.toLowerCase().replace(/[^a-z0-9]/g, '');
          columns.push({ id, label });
        }
      }

      results.push({ id: sublistId, columns });
    }

    return results;
  });

  // Step 2: For each discovered sublist, read line counts and values via nlapi
  const sublists: NsSublistData[] = [];

  for (const sub of discovered) {
    const { lineCount, lines } = await page.evaluate(
      ({ sublistId, columnIds }: { sublistId: string; columnIds: string[] }) => {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const w = window as any;
        const count: number = typeof w.nlapiGetLineItemCount === 'function'
          ? (w.nlapiGetLineItemCount(sublistId) ?? 0)
          : 0;

        const lines: Array<{ line: number; values: Record<string, string> }> = [];
        if (typeof w.nlapiGetLineItemValue === 'function' && count > 0) {
          for (let i = 1; i <= count; i++) {
            const values: Record<string, string> = {};
            for (const colId of columnIds) {
              values[colId] = w.nlapiGetLineItemValue(sublistId, colId, i) ?? '';
            }
            lines.push({ line: i, values });
          }
        }

        return { lineCount: count, lines };
        /* eslint-enable @typescript-eslint/no-explicit-any */
      },
      { sublistId: sub.id, columnIds: sub.columns.map(c => c.id) },
    );

    sublists.push({
      id: sub.id,
      columns: sub.columns,
      lineCount,
      lines,
    });
  }

  return sublists;
}
