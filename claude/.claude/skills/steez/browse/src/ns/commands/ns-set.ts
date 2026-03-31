/**
 * ns set — Set a field value with auto-detect cascading behavior.
 *
 * Usage:
 *   ns set entity 42              → auto-detect: entity-ref → fire cascading
 *   ns set memo "Purchase for Q1" → auto-detect: text → suppress cascading
 *   ns set entity 42 --source     → force fire cascading regardless of field type
 *   ns set entity 42 --no-source  → force suppress cascading
 *
 * Cascading strategy:
 *   Fire cascading:    nlapiSetFieldValue(id, val, false, false)
 *   Suppress cascading: nlapiSetFieldValue(id, val, true, true)
 *
 * When cascading is fired, polls all non-disabled fields for convergence
 * (dependent fields may be asynchronously updated by NetSuite sourcing).
 */

import type { BrowserManager } from '../../core/browser-manager';
import type { NsCommandOutput } from '../format';
import { formatNsError, truncateValue } from '../format';
import type { NsResult } from '../errors';
import type { CapturedDialog } from '../utils/with-dialog-handler';
import { guardNsApi, validationError } from '../errors';
import { introspectField, introspectAllFields } from '../utils/introspect-field';
import { createPageGetter, waitForFieldConvergence } from '../convergence';
import { withDialogHandler } from '../utils/with-dialog-handler';
import { withMutex, nsMutex } from '../mutex';

// ─── Types ──────────────────────────────────────────────────

interface FieldChange {
  id: string;
  before: string | null;
  after: string | null;
}

interface NsSetData {
  fieldId: string;
  value: string;
  cascading: 'fired' | 'suppressed';
  settled: boolean;
  elapsedMs: number;
  diff: { changed: FieldChange[] };
  dialogs: CapturedDialog[];
}

// ─── Arg Parsing ────────────────────────────────────────────

function parseSetArgs(args: string[]): {
  fieldId: string | null;
  value: string | null;
  forceSource: boolean | null;
} {
  let fieldId: string | null = null;
  let value: string | null = null;
  let forceSource: boolean | null = null;

  const positional: string[] = [];
  for (const arg of args) {
    if (arg === '--source') {
      forceSource = true;
    } else if (arg === '--no-source') {
      forceSource = false;
    } else {
      positional.push(arg);
    }
  }

  fieldId = positional[0] ?? null;
  value = positional[1] ?? null;

  return { fieldId, value, forceSource };
}

// ─── ns set ─────────────────────────────────────────────────

export async function nsSet(args: string[], bm: BrowserManager): Promise<NsCommandOutput> {
  const result = await withMutex(nsMutex, async (): Promise<NsResult<NsSetData>> => {
      const start = Date.now();
      const target = bm.getActiveFrameOrPage();

      // ── Validate args ────────────────────────────────────────
      const { fieldId, value, forceSource } = parseSetArgs(args);

      if (!fieldId || value === null) {
        return {
          ok: false as const,
          error: validationError('Missing arguments. Usage: ns set <fieldId> <value> [--source|--no-source]'),
        };
      }

      // ── Guard: must be on a NS page with client API ──────────
      const guardErr = await guardNsApi(target);
      if (guardErr) {
        return { ok: false as const, error: guardErr };
      }

      // ── Introspect the target field ──────────────────────────
      const fieldMeta = await introspectField(target, fieldId);
      if (!fieldMeta) {
        return {
          ok: false as const,
          error: validationError(`Field "${fieldId}" not found on this form`),
        };
      }

      // ── Decide cascading strategy ────────────────────────────
      let fireCascading: boolean;
      if (forceSource === true) {
        fireCascading = true;
      } else if (forceSource === false) {
        fireCascading = false;
      } else {
        // Auto-detect: entity-ref fields fire cascading
        fireCascading = fieldMeta.isEntityRef;
      }

      const cascadingLabel: 'fired' | 'suppressed' = fireCascading ? 'fired' : 'suppressed';

      // fireSlavingWhenever and fireFieldChanged flags:
      //   Fire cascading:    (false, false) — don't suppress
      //   Suppress cascading: (true, true)  — suppress
      const fireSlavingWhenever = !fireCascading;
      const fireFieldChanged = !fireCascading;

      // ── Snapshot field values before set (for diff) ──────────
      let watchFieldIds: string[] = [];
      let beforeValues: Record<string, string | null> = {};

      if (fireCascading) {
        // Read all non-disabled fields for convergence tracking
        const allFields = await introspectAllFields(target);
        watchFieldIds = allFields
          .filter(f => !f.disabled && f.id !== fieldId)
          .map(f => f.id);

        const getter = createPageGetter(target);
        beforeValues = await getter(watchFieldIds);
      }

      // ── Set the field value with dialog capture ──────────────
      const { result: setResult, dialogs } = await withDialogHandler(
        bm,
        async () => {
          const page = bm.getPage();

          // Set the value
          await page.evaluate(
            ({ fid, val, fsw, ffc }: { fid: string; val: string; fsw: boolean; ffc: boolean }) => {
              (window as any).nlapiSetFieldValue(fid, val, fsw, ffc);
            },
            { fid: fieldId, val: value, fsw: fireSlavingWhenever, ffc: fireFieldChanged },
          );

          // Verify value was set — custom forms with indexed widgets (hddn_{field}_{N})
          // can silently fail. If the value didn't stick, try syncing the indexed DOM element directly.
          const verifiedValue = await page.evaluate(
            (fid: string) => (window as any).nlapiGetFieldValue?.(fid) ?? null,
            fieldId,
          );
          // Compare trimmed values — NS sometimes returns padded strings
          const valueMatches = verifiedValue !== null && String(verifiedValue).trim() === String(value).trim();
          if (!valueMatches && fieldMeta.type === 'select') {
            // Fallback: directly sync indexed hidden/select elements on custom forms
            await page.evaluate(
              ({ fid, val }: { fid: string; val: string }) => {
                const w = window as any;
                // Retry the API call once
                try { w.nlapiSetFieldValue?.(fid, val); } catch {}
                // Direct DOM fallback: find indexed hidden elements and sync them
                const form = document.getElementById('main_form');
                if (!form) return;
                const hddn = form.querySelector(`[id^="hddn_${fid}_"]`) as HTMLInputElement | null;
                if (hddn) {
                  hddn.value = val;
                  // Also sync the visible select widget (must be an actual <select>)
                  const inpt = form.querySelector(`select[id^="inpt_${fid}_"]`) as HTMLSelectElement | null;
                  if (inpt && inpt.options) {
                    for (let i = 0; i < inpt.options.length; i++) {
                      if (inpt.options[i].value === val) {
                        inpt.selectedIndex = i;
                        break;
                      }
                    }
                  }
                }
              },
              { fid: fieldId, val: value },
            );
          }

          // If cascading was fired, wait for convergence
          let settled = true;
          if (fireCascading && watchFieldIds.length > 0) {
            const convergence = await waitForFieldConvergence(target, watchFieldIds, {
              stablePolls: 3,
              initialIntervalMs: 50,
              maxIntervalMs: 200,
              timeoutMs: 5000,
            });
            settled = convergence.converged;
          }

          return { settled };
        },
        { accept: true },
      );

      // ── Compute diff ─────────────────────────────────────────
      const changed: FieldChange[] = [];
      if (fireCascading && watchFieldIds.length > 0) {
        const getter = createPageGetter(target);
        const afterValues = await getter(watchFieldIds);

        for (const fid of watchFieldIds) {
          const before = beforeValues[fid] ?? null;
          const after = afterValues[fid] ?? null;
          if (before !== after) {
            changed.push({ id: fid, before, after });
          }
        }
      }

      const elapsed = Date.now() - start;

      return {
        ok: true as const,
        data: {
          fieldId,
          value,
          cascading: cascadingLabel,
          settled: setResult.settled,
          elapsedMs: elapsed,
          diff: { changed },
          dialogs,
        },
        dialogs,
      };
    }, { label: 'ns set' });

  if (!result.ok) {
    return { display: formatNsError('ns set', result.error!), ok: false };
  }

  const d = result.data!;
  const lines = [`SET OK | Field: ${d.fieldId} = ${truncateValue(d.value)} | Cascading: ${d.cascading} | Settled: ${d.settled ? 'yes' : 'no'}`];
  for (const c of d.diff.changed) {
    lines.push(`Changed: ${c.id} ${truncateValue(c.before)} → ${truncateValue(c.after)}`);
  }
  if (d.dialogs.length > 0) {
    for (const dl of d.dialogs) {
      lines.push(`Dialog (${dl.type}): ${truncateValue(dl.message)}`);
    }
  }

  return { display: lines.join('\n'), ok: true };
}
