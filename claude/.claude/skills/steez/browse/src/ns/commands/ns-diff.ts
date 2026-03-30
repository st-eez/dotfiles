/**
 * ns diff — Snapshot-and-observe command for field change detection.
 *
 * Usage:
 *   ns diff                         → baseline snapshot (no action, no changes)
 *   ns diff set salesrep 99         → set a field and show ALL fields that changed
 *   ns diff set companyname "Foo"   → set a text field and show what changed
 *
 * Unlike ns set (which only tracks changes when cascading is fired), ns diff
 * always captures a full before/after snapshot of every field on the form.
 * This makes it useful for understanding the full impact of any mutation.
 *
 * Flow: guardNsApi → snapshot "before" → action (if args) → settle → snapshot "after" → compare
 */

import type { BrowserManager } from '../../core/browser-manager';
import type { NsCommandOutput } from '../format';
import { formatNsError, truncateValue } from '../format';
import type { NsResult } from '../errors';
import type { NsFieldMetadata } from '../utils/introspect-field';
import { guardNsApi, validationError } from '../errors';
import { introspectAllFields } from '../utils/introspect-field';
import { createPageGetter, waitForFieldConvergence } from '../convergence';
import { withMutex, nsMutex } from '../mutex';

// ─── Types ──────────────────────────────────────────────────

interface FieldSnapshot {
  value: string | null;
  displayValue: string | null;
}

interface FieldChange {
  id: string;
  before: FieldSnapshot;
  after: FieldSnapshot;
}

interface NsDiffData {
  action: string | null;
  before: Record<string, FieldSnapshot>;
  after: Record<string, FieldSnapshot>;
  changed: FieldChange[];
  unchanged: number;
}

// ─── Helpers ────────────────────────────────────────────────

/** Convert an array of NsFieldMetadata into a snapshot map. */
function toSnapshotMap(fields: NsFieldMetadata[]): Record<string, FieldSnapshot> {
  const map: Record<string, FieldSnapshot> = {};
  for (const f of fields) {
    map[f.id] = { value: f.value, displayValue: f.displayValue };
  }
  return map;
}

// ─── ns diff ────────────────────────────────────────────────

export async function nsDiff(args: string[], bm: BrowserManager): Promise<NsCommandOutput> {
  const result = await withMutex(nsMutex, async (): Promise<NsResult<NsDiffData>> => {
      const target = bm.getActiveFrameOrPage();

      // ── Guard: must be on a NS page with client API ──────────
      const guardErr = await guardNsApi(target);
      if (guardErr) {
        return { ok: false as const, error: guardErr };
      }

      // ── Snapshot "before" ────────────────────────────────────
      const beforeFields = await introspectAllFields(target);
      const beforeMap = toSnapshotMap(beforeFields);

      // ── Parse action args ────────────────────────────────────
      // Format: ns diff [action] [actionArgs...]
      // Currently only "set" is supported as an action.
      let actionLabel: string | null = null;

      if (args.length > 0) {
        const action = args[0];

        if (action !== 'set') {
          return {
            ok: false as const,
            error: validationError(`Unknown diff action: "${action}". Supported actions: set`),
          };
        }

        const actionArgs = args.slice(1);

        if (actionArgs.length < 2) {
          return {
            ok: false as const,
            error: validationError('Missing arguments. Usage: ns diff set <fieldId> <value>'),
          };
        }

        const fieldId = actionArgs[0];
        const value = actionArgs[1];
        actionLabel = `set ${fieldId} ${value}`;

        // ── Execute the set operation ────────────────────────────
        const page = bm.getPage();

        // Determine cascading behavior: fire for entity-ref fields
        const fieldMeta = beforeFields.find(f => f.id === fieldId);
        if (!fieldMeta) {
          return {
            ok: false as const,
            error: validationError(`Field "${fieldId}" not found on this form`),
          };
        }

        const fireCascading = fieldMeta.isEntityRef;
        const fireSlavingWhenever = !fireCascading;
        const fireFieldChanged = !fireCascading;

        await page.evaluate(
          ({ fid, val, fsw, ffc }: { fid: string; val: string; fsw: boolean; ffc: boolean }) => {
            (window as any).nlapiSetFieldValue(fid, val, fsw, ffc);
          },
          { fid: fieldId, val: value, fsw: fireSlavingWhenever, ffc: fireFieldChanged },
        );

        // ── Wait for convergence if cascading was fired ──────────
        if (fireCascading) {
          const watchFieldIds = beforeFields
            .filter(f => !f.disabled && f.id !== fieldId)
            .map(f => f.id);

          if (watchFieldIds.length > 0) {
            await waitForFieldConvergence(target, watchFieldIds, {
              stablePolls: 3,
              initialIntervalMs: 50,
              maxIntervalMs: 200,
              timeoutMs: 5000,
            });
          }
        }
      }

      // ── Snapshot "after" ─────────────────────────────────────
      const afterFields = await introspectAllFields(target);
      const afterMap = toSnapshotMap(afterFields);

      // ── Compare ──────────────────────────────────────────────
      const allFieldIds = new Set([
        ...Object.keys(beforeMap),
        ...Object.keys(afterMap),
      ]);

      const changed: FieldChange[] = [];
      let unchanged = 0;

      for (const id of allFieldIds) {
        const before = beforeMap[id] ?? { value: null, displayValue: null };
        const after = afterMap[id] ?? { value: null, displayValue: null };

        if (before.value !== after.value || before.displayValue !== after.displayValue) {
          changed.push({ id, before, after });
        } else {
          unchanged++;
        }
      }

      return {
        ok: true as const,
        data: {
          action: actionLabel,
          before: beforeMap,
          after: afterMap,
          changed,
          unchanged,
        },
      };
    }, { label: 'ns diff' });

  if (!result.ok) {
    return { display: formatNsError('ns diff', result.error!), ok: false };
  }

  const d = result.data!;
  const actionLabel = d.action ? `Action: ${d.action}` : 'Baseline snapshot';
  const lines = [`DIFF OK | ${actionLabel} | ${d.changed.length} changed, ${d.unchanged} unchanged`];
  for (const c of d.changed) {
    lines.push(`Changed: ${c.id} ${truncateValue(c.before.value)} → ${truncateValue(c.after.value)}`);
  }

  return { display: lines.join('\n'), ok: true };
}
