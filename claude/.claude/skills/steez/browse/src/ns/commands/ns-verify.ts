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
import type { NsCommandResult } from '../errors';
import type { NsFormMode } from '../utils/introspect-field';
import { RECORD_URL_MAP } from '../tier1';
import { guardNsApi, nsOk, nsFail, notARecordPage, validationError } from '../errors';
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

export async function nsVerify(args: string[], bm: BrowserManager): Promise<string> {
  const start = Date.now();

  if (args.length === 0) {
    const result: NsCommandResult = nsFail(
      validationError('Missing arguments. Usage: ns verify <recordType> <id> field=value ... | ns verify --current field=value ...'),
      Date.now() - start,
    );
    return JSON.stringify(result);
  }

  const parsed = parseVerifyArgs(args);

  if (parsed.expectations.length === 0) {
    const result: NsCommandResult = nsFail(
      validationError('No field=value expectations provided. Usage: ns verify ... field=value [field=value ...]'),
      Date.now() - start,
    );
    return JSON.stringify(result);
  }

  return withMutex(nsMutex, async () => {
    try {
      const page = bm.getPage();

      // Navigate if not --current
      if (!parsed.current) {
        if (!parsed.recordType) {
          const result: NsCommandResult = nsFail(
            validationError('Missing record type. Usage: ns verify <recordType> <id> field=value ...'),
            Date.now() - start,
          );
          return JSON.stringify(result);
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
        const result: NsCommandResult = nsFail(guardErr, Date.now() - start);
        return JSON.stringify(result);
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
          // Field not found on the page — counts as mismatch
          mismatches.push({
            field: exp.field,
            expected: exp.value,
            actual: { value: null, displayValue: null },
          });
          continue;
        }

        // Match against both value and displayValue — either match counts as pass
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

      const data: NsVerifyData = {
        verified: mismatches.length === 0,
        mismatches,
        matched,
        record: {
          type: parsed.recordType,
          id: parsed.id,
          mode,
          fieldCount: fields.length,
        },
      };

      const result: NsCommandResult<NsVerifyData> = nsOk(data, Date.now() - start);
      return JSON.stringify(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const result: NsCommandResult = nsFail(
        notARecordPage(`Verify failed: ${message}`),
        Date.now() - start,
      );
      return JSON.stringify(result);
    }
  }, { label: 'ns verify' });
}
