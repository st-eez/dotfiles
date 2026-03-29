/**
 * Retry wrapper and DOM settle detection for NetSuite operations.
 *
 * NetSuite's SuiteScript engine performs async DOM mutations after field changes
 * (cascading sourcing, postbacks, validation). Unlike simple network requests,
 * these mutations don't always trigger Playwright's networkidle heuristic.
 *
 * withRetry: retries a failing async operation with exponential backoff.
 * waitForSettle: polls a DOM snapshot hash until the page stabilizes.
 *
 * Used by: ns set (wait for sourcing cascade), ns save (wait for postback),
 * ns add-row (wait for sublist row insertion).
 */

import type { Page, Frame } from 'playwright';

// ─── withRetry ──────────────────────────────────────────────

export interface RetryOptions {
  /** Max number of attempts (including the first). Default: 3 */
  maxAttempts?: number;
  /** Base delay between retries in ms (doubled each retry). Default: 500 */
  baseDelayMs?: number;
  /** Total timeout in ms (all attempts combined). Default: 15000 */
  timeoutMs?: number;
  /** Optional label for error messages */
  label?: string;
}

/**
 * Retry an async operation with exponential backoff.
 * Throws the last error if all attempts fail or timeout is exceeded.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions,
): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? 3;
  const baseDelayMs = opts?.baseDelayMs ?? 500;
  const timeoutMs = opts?.timeoutMs ?? 15_000;
  const label = opts?.label ?? 'withRetry';

  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= timeoutMs) {
      throw new Error(`${label}: timeout after ${elapsed}ms (${attempt - 1} attempts). Last error: ${lastError?.message}`);
    }

    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxAttempts) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), timeoutMs - elapsed);
        if (delay > 0) await sleep(delay);
      }
    }
  }

  throw new Error(`${label}: all ${maxAttempts} attempts failed. Last error: ${lastError?.message}`);
}

// ─── waitForSettle ──────────────────────────────────────────

export interface SettleOptions {
  /** How often to poll the DOM hash, in ms. Default: 200 */
  intervalMs?: number;
  /** How long the DOM must be unchanged to count as "settled". Default: 600 */
  stableMs?: number;
  /** Absolute timeout. Default: 10000 */
  timeoutMs?: number;
  /** CSS selector to scope observation (default: body). Useful to watch a specific form region. */
  scope?: string;
}

export interface SettleResult {
  settled: boolean;
  elapsedMs: number;
}

/**
 * Wait until the page DOM stabilizes — no changes for `stableMs` milliseconds.
 *
 * Polls a lightweight DOM hash (textContent length + element count + key form values)
 * rather than full innerHTML to minimize page disruption.
 */
export async function waitForSettle(
  target: Page | Frame,
  opts?: SettleOptions,
): Promise<SettleResult> {
  const intervalMs = opts?.intervalMs ?? 200;
  const stableMs = opts?.stableMs ?? 600;
  const timeoutMs = opts?.timeoutMs ?? 10_000;
  const scope = opts?.scope ?? 'body';

  const startTime = Date.now();
  let lastHash = await domHash(target, scope);
  let lastChangeTime = startTime;

  while (true) {
    const now = Date.now();
    const elapsed = now - startTime;

    if (elapsed >= timeoutMs) {
      return { settled: false, elapsedMs: elapsed };
    }

    if (now - lastChangeTime >= stableMs) {
      return { settled: true, elapsedMs: now - startTime };
    }

    await sleep(intervalMs);

    const currentHash = await domHash(target, scope);
    if (currentHash !== lastHash) {
      lastHash = currentHash;
      lastChangeTime = Date.now();
    }
  }
}

// ─── DOM hash (lightweight fingerprint) ─────────────────────

async function domHash(target: Page | Frame, scope: string): Promise<string> {
  return target.evaluate((sel: string) => {
    const root = document.querySelector(sel);
    if (!root) return '0:0:';

    // Use truncated textContent for sensitivity — length alone misses same-length mutations
    const text = (root.textContent ?? '').slice(0, 500);
    const elCount = root.querySelectorAll('*').length;

    // Include input values — NetSuite mutations often change field values without changing DOM structure
    const inputs = root.querySelectorAll('input, select, textarea');
    const valueFingerprint = Array.from(inputs)
      .slice(0, 100) // Cap to avoid perf issues on large forms
      .map(el => (el as HTMLInputElement).value ?? '')
      .join('|');

    return `${text}:${elCount}:${valueFingerprint}`;
  }, scope);
}

// ─── Helpers ────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
