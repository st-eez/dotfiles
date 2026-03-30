/**
 * Convergence polling algorithm for NetSuite field settle-detection.
 *
 * After setting a field value (especially entity-ref fields), NetSuite fires
 * sourcing cascades that asynchronously update dependent fields. This module
 * polls specific field values and determines when they've stabilized.
 *
 * Design:
 *   - Tracks a set of "watched" field IDs
 *   - Polls all watched fields in a single batch call (O(1) roundtrips)
 *   - Requires N consecutive identical polls to declare "converged"
 *   - Uses adaptive polling: starts fast (50ms), backs off to 200ms
 *   - Never silently swallows timeouts — returns partial state
 *
 * The algorithm is pure — it takes a field-value getter function, so it can
 * be tested without Playwright.
 */

import type { Page, Frame } from 'playwright';

// ─── Types ──────────────────────────────────────────────────

export type FieldValueMap = Record<string, string | null>;

/** Function that reads current values for the given field IDs */
export type FieldValueGetter = (fieldIds: string[]) => Promise<FieldValueMap>;

export interface ConvergenceOptions {
  /** Field IDs to watch for convergence */
  fieldIds: string[];
  /** Number of consecutive stable polls required. Default: 3 */
  stablePolls?: number;
  /** Initial polling interval in ms. Default: 50 */
  initialIntervalMs?: number;
  /** Max polling interval in ms (after backoff). Default: 200 */
  maxIntervalMs?: number;
  /** Absolute timeout in ms. Default: 5000 */
  timeoutMs?: number;
}

export interface ConvergenceResult {
  /** Did all watched fields converge within the timeout? */
  converged: boolean;
  /** Final values of all watched fields */
  values: FieldValueMap;
  /** Field IDs that were still changing when we stopped */
  pendingFields: string[];
  /** Total time spent polling */
  elapsedMs: number;
  /** Number of polls performed */
  pollCount: number;
}

// ─── Core Algorithm ─────────────────────────────────────────

/**
 * Poll field values until they stabilize (N consecutive identical polls)
 * or timeout is reached.
 *
 * @param getter - Function that reads current field values (injected for testability)
 * @param opts - Convergence options
 */
export async function pollUntilConverged(
  getter: FieldValueGetter,
  opts: ConvergenceOptions,
): Promise<ConvergenceResult> {
  const {
    fieldIds,
    stablePolls = 3,
    initialIntervalMs = 50,
    maxIntervalMs = 200,
    timeoutMs = 5000,
  } = opts;

  if (fieldIds.length === 0) {
    return { converged: true, values: {}, pendingFields: [], elapsedMs: 0, pollCount: 0 };
  }

  const startTime = Date.now();
  let intervalMs = initialIntervalMs;
  let pollCount = 0;

  // Track consecutive stable counts per field
  const stableCounts: Record<string, number> = {};
  let lastValues: FieldValueMap = {};

  for (const id of fieldIds) {
    stableCounts[id] = 0;
  }

  while (true) {
    const currentValues = await getter(fieldIds);
    pollCount++;

    // Compare each field to its previous value
    let allConverged = true;
    for (const id of fieldIds) {
      const current = currentValues[id] ?? null;
      const previous = lastValues[id] ?? null;

      if (current === previous && pollCount > 1) {
        stableCounts[id]++;
      } else {
        stableCounts[id] = 0; // Reset on change
      }

      if (stableCounts[id] < stablePolls - 1) {
        // Need (stablePolls - 1) consecutive matches after first read
        allConverged = false;
      }
    }

    lastValues = currentValues;

    if (allConverged && pollCount > 1) {
      return {
        converged: true,
        values: currentValues,
        pendingFields: [],
        elapsedMs: Date.now() - startTime,
        pollCount,
      };
    }

    // Check timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= timeoutMs) {
      const pending = fieldIds.filter(id => stableCounts[id] < stablePolls - 1);
      return {
        converged: false,
        values: currentValues,
        pendingFields: pending,
        elapsedMs: elapsed,
        pollCount,
      };
    }

    // Adaptive backoff
    await sleep(intervalMs);
    intervalMs = Math.min(intervalMs * 1.5, maxIntervalMs);
  }
}

// ─── Playwright Integration ─────────────────────────────────

/**
 * Create a FieldValueGetter that reads NS field values via page.evaluate().
 * Single evaluate call per poll — O(1) roundtrips regardless of field count.
 */
export function createPageGetter(target: Page | Frame): FieldValueGetter {
  return async (fieldIds: string[]): Promise<FieldValueMap> => {
    return target.evaluate((ids: string[]) => {
      const result: Record<string, string | null> = {};
      for (const id of ids) {
        // Subrecord fields (billingaddress, shippingaddress) throw nlobjError
        try { result[id] = (window as any).nlapiGetFieldValue?.(id) ?? null; } catch { result[id] = null; }
      }
      return result;
    }, fieldIds);
  };
}

/**
 * High-level: wait for specific fields to converge on the current page.
 * Combines createPageGetter with pollUntilConverged.
 */
export async function waitForFieldConvergence(
  target: Page | Frame,
  fieldIds: string[],
  opts?: Partial<Omit<ConvergenceOptions, 'fieldIds'>>,
): Promise<ConvergenceResult> {
  const getter = createPageGetter(target);
  return pollUntilConverged(getter, { fieldIds, ...opts });
}

// ─── Helpers ────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
