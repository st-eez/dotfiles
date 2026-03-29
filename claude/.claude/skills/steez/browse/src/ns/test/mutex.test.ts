/**
 * Unit tests for NS command mutex (per-page request queue).
 */

import { describe, test, expect } from 'bun:test';
import { NsMutex, withMutex } from '../mutex';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── NsMutex ────────────────────────────────────────────────

describe('NsMutex', () => {
  test('acquire returns immediately when unlocked', async () => {
    const mutex = new NsMutex();
    expect(mutex.isLocked).toBe(false);

    const release = await mutex.acquire('test');
    expect(mutex.isLocked).toBe(true);
    expect(mutex.totalAcquired).toBe(1);

    release();
    expect(mutex.isLocked).toBe(false);
  });

  test('second acquire waits until first releases', async () => {
    const mutex = new NsMutex();
    const order: number[] = [];

    const release1 = await mutex.acquire('first');
    expect(mutex.pending).toBe(0);

    // Second acquire should queue
    const p2 = mutex.acquire('second').then(release2 => {
      order.push(2);
      release2();
    });

    expect(mutex.pending).toBe(1);
    order.push(1);
    release1(); // This should unblock second

    await p2;
    expect(order).toEqual([1, 2]);
    expect(mutex.isLocked).toBe(false);
    expect(mutex.totalAcquired).toBe(2);
  });

  test('FIFO ordering with 3 waiters', async () => {
    const mutex = new NsMutex();
    const order: string[] = [];

    const release1 = await mutex.acquire('first');

    const p2 = mutex.acquire('second').then(r => {
      order.push('second');
      r();
    });
    const p3 = mutex.acquire('third').then(r => {
      order.push('third');
      r();
    });
    const p4 = mutex.acquire('fourth').then(r => {
      order.push('fourth');
      r();
    });

    expect(mutex.pending).toBe(3);
    release1();

    await Promise.all([p2, p3, p4]);
    expect(order).toEqual(['second', 'third', 'fourth']);
  });

  test('release is idempotent', async () => {
    const mutex = new NsMutex();
    const release = await mutex.acquire('test');

    release();
    release(); // Should not throw or double-unlock
    expect(mutex.isLocked).toBe(false);
  });

  test('acquire with timeout rejects when queue is blocked', async () => {
    const mutex = new NsMutex();
    const release = await mutex.acquire('holder');

    await expect(
      mutex.acquire('waiter', 100), // 100ms timeout
    ).rejects.toThrow(/timed out/);

    expect(mutex.totalTimedOut).toBe(1);
    expect(mutex.pending).toBe(0); // Timed-out entry removed from queue

    release();
  });

  test('acquire with timeout succeeds if lock released in time', async () => {
    const mutex = new NsMutex();
    const release = await mutex.acquire('holder');

    // Release after 50ms
    setTimeout(() => release(), 50);

    const release2 = await mutex.acquire('waiter', 500);
    expect(mutex.isLocked).toBe(true);
    release2();
  });

  test('timed-out waiter does not affect subsequent waiters', async () => {
    const mutex = new NsMutex();
    const release = await mutex.acquire('holder');

    // This one will time out
    const p1 = mutex.acquire('timeout-waiter', 50).catch(() => 'timed-out');
    // This one has a longer timeout
    const p2 = mutex.acquire('patient-waiter', 500);

    await p1; // Wait for timeout

    expect(mutex.pending).toBe(1); // Only patient-waiter remains
    release();

    const release2 = await p2;
    release2();
    expect(mutex.isLocked).toBe(false);
  });
});

// ─── withMutex ──────────────────────────────────────────────

describe('withMutex', () => {
  test('executes function and releases lock', async () => {
    const mutex = new NsMutex();

    const result = await withMutex(mutex, async () => {
      expect(mutex.isLocked).toBe(true);
      return 'done';
    });

    expect(result).toBe('done');
    expect(mutex.isLocked).toBe(false);
  });

  test('releases lock even on error', async () => {
    const mutex = new NsMutex();

    await expect(
      withMutex(mutex, async () => { throw new Error('boom'); }),
    ).rejects.toThrow('boom');

    expect(mutex.isLocked).toBe(false);
  });

  test('serializes concurrent calls', async () => {
    const mutex = new NsMutex();
    const order: number[] = [];

    const p1 = withMutex(mutex, async () => {
      order.push(1);
      await sleep(50);
      order.push(2);
    }, { label: 'first' });

    const p2 = withMutex(mutex, async () => {
      order.push(3);
      await sleep(50);
      order.push(4);
    }, { label: 'second' });

    await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2, 3, 4]); // Serialized, not interleaved
  });

  test('acquire timeout rejects before running fn', async () => {
    const mutex = new NsMutex();
    let fnRan = false;

    const release = await mutex.acquire('blocker');

    await expect(
      withMutex(mutex, async () => { fnRan = true; return 'ok'; }, {
        acquireTimeoutMs: 50,
        label: 'timeout-test',
      }),
    ).rejects.toThrow(/timed out/);

    expect(fnRan).toBe(false);
    release();
  });

  test('operation timeout kills long-running function', async () => {
    const mutex = new NsMutex();

    await expect(
      withMutex(mutex, async () => {
        await sleep(500); // Takes too long
        return 'never';
      }, { operationTimeoutMs: 50, label: 'slow-op' }),
    ).rejects.toThrow(/operation timed out/);

    // Lock should be released even after timeout
    expect(mutex.isLocked).toBe(false);
  });
});
