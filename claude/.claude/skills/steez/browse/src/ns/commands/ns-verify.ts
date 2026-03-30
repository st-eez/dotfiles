/**
 * ns verify — Post-save correctness check.
 *
 * Reloads a record and verifies field values match expectations.
 *
 * Usage:
 *   ns verify salesorder 12345 entity=42 total=1500.00   → navigate to record, check fields
 *   ns verify --current entity=42 total=1500.00           → verify current page without navigating
 *
 * Compares expected values against both `value` and `displayValue` from introspection —
 * either match counts as a pass.
 */

import type { BrowserManager } from '../../core/browser-manager';
import type { NsCommandOutput } from '../format';
import { formatNsError, truncateValue } from '../format';
import type { NsResult } from '../errors';
import type { NsFormMode } from '../utils/introspect-field';
import { RECORD_URL_MAP } from '../tier1';
import { guardNsApi, notARecordPage, validationError } from '../errors';
import { introspectAllFields, detectFormMode } from '../utils/introspect-field';
import { withMutex, nsMutex } from '../mutex';

// ─── Types ──────────────────────────────────────────────────

interface FieldMismatch {
  field: string;
  expected: string;
  actual: { value: string | null; displayValue: string | null };
}

interface FieldMatch {
  field: string;
  expected: string;
  actual: string;
}

interface NsVerifyData {
  verified: boolean;
  mismatches: FieldMismatch[];
  matched: FieldMatch[];
  record: { type: string | null; id: string | null; mode: NsFormMode; fieldCount: number };
}

// ─── Arg Parsing ────────────────────────────────────────────

interface VerifyArgs {
  current: boolean;
  recordType: string | null;
  id: string | null;
  expectations: Array<{ field: string; value: string }>;
}

function parseVerifyArgs(args: string[]): VerifyArgs {
  const result: VerifyArgs = {
    current: false,
    recordType: null,
    id: null,
    expectations: [],
  };

  let i = 0;

  if (args.length > 0 && args[0] === '--current') {
    result.current = true;
    i = 1;
  } else {
    // First positional = recordType, second = id
    if (args.length > 0 && !args[0].includes('=')) {
      result.recordType = args[0];
      i = 1;
    }
    if (i < args.length && !args[i].includes('=')) {
      result.id = args[i];
      i++;
    }
  }

  // Remaining args are field=value expectations
  for (; i < args.length; i++) {
    const eq = args[i].indexOf('=');
    if (eq > 0) {
      result.expectations.push({
        field: args[i].slice(0, eq),
        value: args[i].slice(eq + 1),
      });
    }
  }

  return result;
}

// ─── ns verify ──────────────────────────────────────────────

export async function nsVerify(args: string[], bm: BrowserManager): Promise<NsCommandOutput> {
  const start = Date.now();

  if (args.length === 0) {
    return { display: formatNsError('ns verify', validationError('Missing arguments. Usage: ns verify <recordType> <id> field=value ... | ns verify --current field=value ...')), ok: false };
  }

  const parsed = parseVerifyArgs(args);

  if (parsed.expectations.length === 0) {
    return { display: formatNsError('ns verify', validationError('No field=value expectations provided. Usage: ns verify ... field=value [field=value ...]')), ok: false };
  }

  const result = await withMutex(nsMutex, async (): Promise<NsResult<NsVerifyData>> => {
    try {
      const page = bm.getPage();

      // Navigate if not --current
      if (!parsed.current) {
        if (!parsed.recordType) {
          return { ok: false as const, error: validationError('Missing record type. Usage: ns verify <recordType> <id> field=value ...') };
        }

        const relativePath = RECORD_URL_MAP.buildUrl(
          parsed.recordType,
          parsed.id ?? undefined,
        );

        const currentUrl = page.url();
        let fullUrl: string;
        try {
          const origin = new URL(currentUrl).origin;
          if (origin && origin !== 'null' && !currentUrl.startsWith('about:')) {
            fullUrl = origin + relativePath;
          } else {
            fullUrl = relativePath;
          }
        } catch {
          fullUrl = relativePath;
        }

        await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      }

      // Guard: must be on a NS page with client API
      const target = bm.getActiveFrameOrPage();
      const guardErr = await guardNsApi(target);
      if (guardErr) {
        return { ok: false as const, error: guardErr };
      }

      // Introspect all fields
      const fields = await introspectAllFields(target);
      const mode = await detectFormMode(target);

      // Build a lookup map by field id
      const fieldMap = new Map(fields.map(f => [f.id, f]));

      // Compare expectations
      const mismatches: FieldMismatch[] = [];
      const matched: FieldMatch[] = [];

      for (const exp of parsed.expectations) {
        const field = fieldMap.get(exp.field);

        if (!field) {
          mismatches.push({
            field: exp.field,
            expected: exp.value,
            actual: { value: null, displayValue: null },
          });
          continue;
        }

        const valueMatch = field.value === exp.value;
        const displayMatch = field.displayValue === exp.value;

        if (valueMatch || displayMatch) {
          matched.push({
            field: exp.field,
            expected: exp.value,
            actual: valueMatch ? (field.value ?? '') : (field.displayValue ?? ''),
          });
        } else {
          mismatches.push({
            field: exp.field,
            expected: exp.value,
            actual: { value: field.value, displayValue: field.displayValue },
          });
        }
      }

      return {
        ok: true as const,
        data: {
          verified: mismatches.length === 0,
          mismatches,
          matched,
          record: { type: parsed.recordType, id: parsed.id, mode, fieldCount: fields.length },
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: notARecordPage(`Verify failed: ${message}`) };
    }
  }, { label: 'ns verify' });

  if (!result.ok) {
    return { display: formatNsError('ns verify', result.error!), ok: false };
  }

  const d = result.data!;
  const recordLabel = [d.record.type, d.record.id].filter(Boolean).join(' ') || 'current';
  const header = d.verified
    ? `VERIFY OK | Record: ${recordLabel}`
    : `VERIFY FAILED | Record: ${recordLabel}`;

  const lines = [header];
  for (const m of d.matched) {
    lines.push(`Matched: ${m.field} = ${truncateValue(m.actual)}`);
  }
  for (const m of d.mismatches) {
    lines.push(`Mismatch: ${m.field} expected ${truncateValue(m.expected)} actual ${truncateValue(m.actual.value)}`);
  }

  return { display: lines.join('\n'), ok: true };
}
