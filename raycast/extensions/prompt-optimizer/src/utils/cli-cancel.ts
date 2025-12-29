/**
 * CLI Cancel - Graceful cancellation handling for CLI test scripts.
 * Provides SIGINT/SIGTERM handling, cleanup callbacks, and partial result saving.
 */

import { log, subheader, c, formatDuration } from "./cli-output";

// ============================================================================
// Cancellation State
// ============================================================================

let cancelled = false;
let cancelCount = 0;
const cancelCallbacks: Array<() => void | Promise<void>> = [];
const cleanupCallbacks: Array<() => void | Promise<void>> = [];

export function wasCancelled(): boolean {
  return cancelled;
}

export function onCancel(callback: () => void | Promise<void>): void {
  cancelCallbacks.push(callback);
}

export function onCleanup(callback: () => void | Promise<void>): void {
  cleanupCallbacks.push(callback);
}

export function resetCancelHandlers(): void {
  cancelled = false;
  cancelCount = 0;
  cancelCallbacks.length = 0;
  cleanupCallbacks.length = 0;
}

// ============================================================================
// Signal Handling
// ============================================================================

let handlerInstalled = false;

export function installCancelHandler(): void {
  if (handlerInstalled) return;
  handlerInstalled = true;

  const handleSignal = async (signal: string) => {
    cancelCount++;

    if (cancelCount === 1) {
      cancelled = true;
      log.warn(`\nReceived ${signal}. Gracefully shutting down...`);
      log.warn("Press Ctrl+C again to force exit.");

      for (const callback of cancelCallbacks) {
        try {
          await callback();
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          log.error(`Cancel callback error: ${msg}`);
        }
      }

      for (const callback of cleanupCallbacks) {
        try {
          await callback();
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          log.error(`Cleanup callback error: ${msg}`);
        }
      }
    } else {
      log.error("\nForce exiting...");
      process.exit(130);
    }
  };

  process.on("SIGINT", () => handleSignal("SIGINT"));
  process.on("SIGTERM", () => handleSignal("SIGTERM"));
}

export function uninstallCancelHandler(): void {
  process.removeAllListeners("SIGINT");
  process.removeAllListeners("SIGTERM");
  handlerInstalled = false;
  resetCancelHandlers();
}

// ============================================================================
// Cancellation Summary
// ============================================================================

interface PartialResults {
  completed: number;
  total: number;
  startTime: number;
  outputPath?: string;
  data?: unknown;
}

let partialResults: PartialResults | null = null;

export function setPartialResults(results: PartialResults): void {
  partialResults = results;
}

export function getPartialResults(): PartialResults | null {
  return partialResults;
}

export function printCancellationSummary(): void {
  if (!partialResults) return;

  const { completed, total, startTime, outputPath } = partialResults;
  const elapsed = Date.now() - startTime;
  const percent = total > 0 ? ((completed / total) * 100).toFixed(1) : "0";

  subheader("Cancellation Summary");
  log.plain(`  ${c.dim("Progress:")} ${completed}/${total} (${percent}%)`);
  log.plain(`  ${c.dim("Duration:")} ${formatDuration(elapsed)}`);

  if (outputPath) {
    log.plain(`  ${c.dim("Partial results saved to:")} ${c.cyan(outputPath)}`);
  }

  log.blank();
}

// ============================================================================
// Cancellation-Aware Helpers
// ============================================================================

export async function withCancellation<T>(fn: () => Promise<T>, onCancelledValue: T): Promise<T> {
  if (wasCancelled()) return onCancelledValue;
  return fn();
}

export function runUnlessCancelled(fn: () => void): boolean {
  if (wasCancelled()) return false;
  fn();
  return true;
}

export async function runAsyncUnlessCancelled(fn: () => Promise<void>): Promise<boolean> {
  if (wasCancelled()) return false;
  await fn();
  return true;
}

export class CancellationError extends Error {
  constructor(message = "Operation cancelled") {
    super(message);
    this.name = "CancellationError";
  }
}

export function throwIfCancelled(): void {
  if (wasCancelled()) {
    throw new CancellationError();
  }
}

export async function allWithCancellation<T>(
  tasks: Array<() => Promise<T>>,
  options?: { concurrency?: number; stopOnCancel?: boolean },
): Promise<Array<T | null>> {
  const { concurrency = Infinity, stopOnCancel = true } = options ?? {};
  const results: Array<T | null> = [];
  const pending: Array<Promise<void>> = [];

  for (let i = 0; i < tasks.length; i++) {
    if (stopOnCancel && wasCancelled()) {
      results.push(null);
      continue;
    }

    const task = tasks[i];
    const index = i;

    const run = async () => {
      if (stopOnCancel && wasCancelled()) {
        results[index] = null;
        return;
      }

      try {
        results[index] = await task();
      } catch (error: unknown) {
        if (error instanceof CancellationError) {
          results[index] = null;
        } else {
          throw error;
        }
      }
    };

    const promise = run();
    pending.push(promise);

    if (pending.length >= concurrency) {
      await Promise.race(pending);
      const completed = pending.findIndex((p) => p.then(() => true).catch(() => true));
      if (completed !== -1) {
        pending.splice(completed, 1);
      }
    }
  }

  await Promise.all(pending);
  return results;
}

// ============================================================================
// Timeout with Cancellation
// ============================================================================

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function delayWithCancellation(ms: number): Promise<boolean> {
  const start = Date.now();
  const checkInterval = 100;

  while (Date.now() - start < ms) {
    if (wasCancelled()) return false;
    await delay(Math.min(checkInterval, ms - (Date.now() - start)));
  }

  return !wasCancelled();
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, timeoutValue: T): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(timeoutValue), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}
