/**
 * ns add-row — Add a sublist row with field values and commit.
 *
 * Usage:
 *   ns add-row item item=100 quantity=5 rate=10.00
 *   ns add-row expense account=6000 amount=500 memo="Office supplies"
 *
 * Lifecycle:
 *   1. nlapiSelectNewLineItem(sublistId) — open a new blank row
 *   2. For each key=value pair, set the column value:
 *      - Detect entity-ref columns via _display companion
 *      - Entity-ref: nlapiSetCurrentLineItemValue(sub, col, val, false, false)
 *      - Other: nlapiSetCurrentLineItemValue(sub, col, val, true, true)
 *      - After entity-ref set, poll for convergence on other columns
 *   3. nlapiCommitLineItem(sublistId) — commit the row
 *   4. Return line number, final values, convergence result
 */

import type { BrowserManager } from '../../core/browser-manager';
import type { NsCommandResult } from '../errors';
import type { CapturedDialog } from '../utils/with-dialog-handler';
import { guardNsApi, nsOk, nsFail, validationError } from '../errors';
import { pollUntilConverged, type FieldValueGetter } from '../convergence';
import { withDialogHandler } from '../utils/with-dialog-handler';
import { withMutex, nsMutex } from '../mutex';

// ─── Types ──────────────────────────────────────────────────

interface NsAddRowData {
  sublist: string;
  lineNumber: number;
  values: Record<string, string | null>;
  settled: boolean;
  elapsedMs: number;
  dialogs: CapturedDialog[];
}

// ─── Arg Parsing ────────────────────────────────────────────

function parseAddRowArgs(args: string[]): {
  sublistId: string | null;
  fieldValues: Array<{ column: string; value: string }>;
} {
  if (args.length === 0) return { sublistId: null, fieldValues: [] };

  const sublistId = args[0];
  const fieldValues: Array<{ column: string; value: string }> = [];

  for (let i = 1; i < args.length; i++) {
    const eqIdx = args[i].indexOf('=');
    if (eqIdx > 0) {
      fieldValues.push({
        column: args[i].slice(0, eqIdx),
        value: args[i].slice(eqIdx + 1),
      });
    }
  }

  return { sublistId, fieldValues };
}

// ─── Sublist line item getter (for convergence polling) ─────

function createLineItemGetter(
  target: import('playwright').Page | import('playwright').Frame,
  sublistId: string,
): FieldValueGetter {
  return async (columnIds: string[]) => {
    return target.evaluate(
      ({ sub, cols }: { sub: string; cols: string[] }) => {
        const result: Record<string, string | null> = {};
        for (const col of cols) {
          result[col] = (window as any).nlapiGetCurrentLineItemValue?.(sub, col) ?? null;
        }
        return result;
      },
      { sub: sublistId, cols: columnIds },
    );
  };
}

// ─── ns add-row ─────────────────────────────────────────────

export async function nsAddRow(args: string[], bm: BrowserManager): Promise<string> {
  return JSON.stringify(
    await withMutex(nsMutex, async (): Promise<NsCommandResult<NsAddRowData>> => {
      const start = Date.now();
      const target = bm.getActiveFrameOrPage();

      // ── Parse args ───────────────────────────────────────────
      const { sublistId, fieldValues } = parseAddRowArgs(args);

      if (!sublistId) {
        return nsFail(
          validationError('Missing sublist ID. Usage: ns add-row <sublistId> col1=val1 col2=val2 ...'),
          Date.now() - start,
        );
      }

      if (fieldValues.length === 0) {
        return nsFail(
          validationError('No field values provided. Usage: ns add-row <sublistId> col1=val1 col2=val2 ...'),
          Date.now() - start,
        );
      }

      // ── Guard ────────────────────────────────────────────────
      const guardErr = await guardNsApi(target);
      if (guardErr) return nsFail(guardErr, Date.now() - start);

      // ── Idempotency guard: capture line count before ─────────
      const lineCountBefore = await target.evaluate(
        (sub: string) => (window as any).nlapiGetLineItemCount?.(sub) ?? 0,
        sublistId,
      );

      // ── Execute with dialog capture ──────────────────────────
      const { result: addResult, dialogs } = await withDialogHandler(
        bm,
        async () => {
          // 1. Select new line
          await target.evaluate(
            (sub: string) => (window as any).nlapiSelectNewLineItem?.(sub),
            sublistId,
          );

          // 2. Set each column value
          const allColumns = fieldValues.map(fv => fv.column);
          let overallSettled = true;

          for (const { column, value } of fieldValues) {
            // Detect entity-ref for this column via _display companion
            const isEntityRef = await target.evaluate(
              ({ sub, col }: { sub: string; col: string }) => {
                const displayEl = document.getElementById(`${sub}_${col}_display`);
                return displayEl !== null;
              },
              { sub: sublistId, col: column },
            );

            const fireSlavingWhenever = !isEntityRef;
            const fireFieldChanged = !isEntityRef;

            await target.evaluate(
              ({ sub, col, val, fsw, ffc }: { sub: string; col: string; val: string; fsw: boolean; ffc: boolean }) => {
                (window as any).nlapiSetCurrentLineItemValue?.(sub, col, val, fsw, ffc);
              },
              { sub: sublistId, col: column, val: value, fsw: fireSlavingWhenever, ffc: fireFieldChanged },
            );

            // If entity-ref, poll other columns for convergence
            if (isEntityRef) {
              const otherColumns = allColumns.filter(c => c !== column);
              if (otherColumns.length > 0) {
                const getter = createLineItemGetter(target, sublistId);
                const convergence = await pollUntilConverged(getter, {
                  fieldIds: otherColumns,
                  stablePolls: 3,
                  initialIntervalMs: 50,
                  maxIntervalMs: 200,
                  timeoutMs: 5000,
                });
                if (!convergence.converged) overallSettled = false;
              }
            }
          }

          // 3. Commit the line
          await target.evaluate(
            (sub: string) => (window as any).nlapiCommitLineItem?.(sub),
            sublistId,
          );

          // 4. Get final line number and values
          const lineNumber = await target.evaluate(
            (sub: string) => (window as any).nlapiGetLineItemCount?.(sub) ?? 0,
            sublistId,
          );

          // Read committed values
          const finalValues = await target.evaluate(
            ({ sub, cols, line }: { sub: string; cols: string[]; line: number }) => {
              const result: Record<string, string | null> = {};
              for (const col of cols) {
                result[col] = (window as any).nlapiGetLineItemValue?.(sub, col, line) ?? null;
              }
              return result;
            },
            { sub: sublistId, cols: allColumns, line: lineNumber },
          );

          return { lineNumber, values: finalValues, settled: overallSettled };
        },
        { accept: true },
      );

      const elapsed = Date.now() - start;

      return nsOk<NsAddRowData>(
        {
          sublist: sublistId,
          lineNumber: addResult.lineNumber,
          values: addResult.values,
          settled: addResult.settled,
          elapsedMs: elapsed,
          dialogs,
        },
        elapsed,
        { dialogs },
      );
    }, { label: 'ns add-row' }),
  );
}
