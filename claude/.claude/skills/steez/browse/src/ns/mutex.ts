/**
 * Per-page command mutex (FIFO request queue).
 *
 * NS commands with convergence polling can take 5+ seconds. Concurrent
 * commands must queue, not race — NetSuite's client-side API is single-threaded.
 *
 * Usage:
 *   const release = await nsMutex.acquire('ns set');
 *   try { ... } finally { release(); }
 *
 * Or with the helper:
 *   const result = await withMutex(nsMutex, () => doWork(), { timeoutMs: 10000 });
 */

// ─── NsMutex ────────────────────────────────────────────────

interface QueueEntry {
  resolve: () => void;
  reject: (err: Error) => void;
  label: string;
  enqueuedAt: number;
}

export class NsMutex {
  private locked = false;
  private queue: QueueEntry[] = [];
  private _totalAcquired = 0;
  private _totalTimedOut = 0;

  /** Acquire the lock. Returns a release function. FIFO ordering. */
  acquire(label: string = 'unknown', timeoutMs?: number): Promise<() => void> {
    if (!this.locked) {
      this.locked = true;
      this._totalAcquired++;
      return Promise.resolve(this.createRelease());
    }

    return new Promise<() => void>((resolve, reject) => {
      const entry: QueueEntry = {
        resolve: () => {
          this._totalAcquired++;
          resolve(this.createRelease());
        },
        reject,
        label,
        enqueuedAt: Date.now(),
      };
      this.queue.push(entry);

      // Optional timeout — reject if we wait too long
      if (timeoutMs !== undefined && timeoutMs > 0) {
        setTimeout(() => {
          const idx = this.queue.indexOf(entry);
          if (idx !== -1) {
            this.queue.splice(idx, 1);
            this._totalTimedOut++;
            reject(new Error(
              `NsMutex: "${label}" timed out after ${timeoutMs}ms (${this.queue.length} still queued)`,
            ));
          }
        }, timeoutMs);
      }
    });
  }

  private createRelease(): () => void {
    let released = false;
    return () => {
      if (released) return; // idempotent
      released = true;

      const next = this.queue.shift();
      if (next) {
        next.resolve();
      } else {
        this.locked = false;
      }
    };
  }

  /** Current queue depth (not counting the active holder) */
  get pending(): number {
    return this.queue.length;
  }

  get isLocked(): boolean {
    return this.locked;
  }

  get totalAcquired(): number {
    return this._totalAcquired;
  }

  get totalTimedOut(): number {
    return this._totalTimedOut;
  }
}

// ─── Helper: withMutex ──────────────────────────────────────

export interface MutexOptions {
  /** Timeout for acquiring the lock (queuing time). Default: no timeout */
  acquireTimeoutMs?: number;
  /** Timeout for the operation itself. Default: no timeout */
  operationTimeoutMs?: number;
  /** Label for debugging. Default: 'withMutex' */
  label?: string;
}

/**
 * Execute `fn` under the mutex. Handles acquire + release automatically.
 * Supports both queue timeout (how long to wait for the lock) and
 * operation timeout (how long the operation can run).
 */
export async function withMutex<T>(
  mutex: NsMutex,
  fn: () => Promise<T>,
  opts?: MutexOptions,
): Promise<T> {
  const label = opts?.label ?? 'withMutex';
  const release = await mutex.acquire(label, opts?.acquireTimeoutMs);

  try {
    if (opts?.operationTimeoutMs) {
      return await withTimeout(fn(), opts.operationTimeoutMs, label);
    }
    return await fn();
  } finally {
    release();
  }
}

// ─── Timeout helper ─────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`NsMutex: "${label}" operation timed out after ${ms}ms`)),
      ms,
    );
    promise
      .then(val => { clearTimeout(timer); resolve(val); })
      .catch(err => { clearTimeout(timer); reject(err); });
  });
}

// ─── Singleton ──────────────────────────────────────────────

/** Global mutex for all NS commands. One command at a time per daemon process. */
export const nsMutex = new NsMutex();
