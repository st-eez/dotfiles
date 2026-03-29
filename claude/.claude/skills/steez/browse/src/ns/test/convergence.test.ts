/**
 * Unit tests for convergence polling algorithm.
 *
 * Pure algorithm tests — no Playwright. Uses mock getter functions
 * to simulate NetSuite field value changes over time.
 */

import { describe, test, expect } from 'bun:test';
import { pollUntilConverged, type FieldValueMap, type FieldValueGetter } from '../convergence';

// ─── Mock getter factory ────────────────────────────────────

/**
 * Create a mock getter that returns different values on successive calls.
 * Each entry in `timeline` is the values returned for that poll.
 * After the timeline is exhausted, the last entry repeats.
 */
function mockGetter(timeline: FieldValueMap[]): FieldValueGetter & { callCount: number } {
  let callIdx = 0;
  const getter = async (fieldIds: string[]): Promise<FieldValueMap> => {
    const snapshot = timeline[Math.min(callIdx, timeline.length - 1)];
    callIdx++;
    const result: FieldValueMap = {};
    for (const id of fieldIds) {
      result[id] = snapshot[id] ?? null;
    }
    return result;
  };
  return Object.assign(getter, {
    get callCount() { return callIdx; },
  });
}

// ─── Basic convergence ──────────────────────────────────────

describe('pollUntilConverged', () => {
  test('converges immediately on static values', async () => {
    const getter = mockGetter([
      { name: 'Acme', total: '100' },
    ]);

    const result = await pollUntilConverged(getter, {
      fieldIds: ['name', 'total'],
      stablePolls: 3,
      initialIntervalMs: 10,
      maxIntervalMs: 10,
      timeoutMs: 2000,
    });

    expect(result.converged).toBe(true);
    expect(result.values).toEqual({ name: 'Acme', total: '100' });
    expect(result.pendingFields).toEqual([]);
    // Needs 1 initial read + 2 confirming polls = 3 minimum polls for stablePolls=3
    expect(result.pollCount).toBeGreaterThanOrEqual(3);
  });

  test('converges after values stabilize', async () => {
    const getter = mockGetter([
      { rate: '10.00' },   // Initial
      { rate: '15.00' },   // Sourcing cascade changes rate
      { rate: '12.50' },   // Still cascading
      { rate: '12.50' },   // Stabilized
      { rate: '12.50' },   // Confirmed
      { rate: '12.50' },   // Confirmed
    ]);

    const result = await pollUntilConverged(getter, {
      fieldIds: ['rate'],
      stablePolls: 3,
      initialIntervalMs: 10,
      maxIntervalMs: 10,
      timeoutMs: 2000,
    });

    expect(result.converged).toBe(true);
    expect(result.values.rate).toBe('12.50');
  });

  test('detects stutter (intermediate stable then change)', async () => {
    const getter = mockGetter([
      { amount: '100' },
      { amount: '200' },   // First change
      { amount: '200' },   // Looks stable...
      { amount: '300' },   // Stutter! Changes again
      { amount: '300' },   // Now stable
      { amount: '300' },   // Confirmed
      { amount: '300' },   // Confirmed
    ]);

    const result = await pollUntilConverged(getter, {
      fieldIds: ['amount'],
      stablePolls: 3,
      initialIntervalMs: 10,
      maxIntervalMs: 10,
      timeoutMs: 2000,
    });

    expect(result.converged).toBe(true);
    expect(result.values.amount).toBe('300');
  });

  test('returns empty for no field IDs', async () => {
    const getter = mockGetter([]);
    const result = await pollUntilConverged(getter, {
      fieldIds: [],
      timeoutMs: 100,
    });
    expect(result.converged).toBe(true);
    expect(result.pollCount).toBe(0);
  });
});

// ─── Multiple fields ────────────────────────────────────────

describe('Multiple field convergence', () => {
  test('waits for ALL fields to converge', async () => {
    const getter = mockGetter([
      { entity: '1', terms: '', currency: '' },
      { entity: '1', terms: 'Net 30', currency: '' },          // terms sourced
      { entity: '1', terms: 'Net 30', currency: 'USD' },       // currency sourced
      { entity: '1', terms: 'Net 30', currency: 'USD' },       // stable 1
      { entity: '1', terms: 'Net 30', currency: 'USD' },       // stable 2
    ]);

    const result = await pollUntilConverged(getter, {
      fieldIds: ['entity', 'terms', 'currency'],
      stablePolls: 3,
      initialIntervalMs: 10,
      maxIntervalMs: 10,
      timeoutMs: 2000,
    });

    expect(result.converged).toBe(true);
    expect(result.values).toEqual({ entity: '1', terms: 'Net 30', currency: 'USD' });
  });

  test('reports pending fields on timeout', async () => {
    let callCount = 0;
    const getter: FieldValueGetter = async (fieldIds) => {
      callCount++;
      return {
        stable: 'fixed',
        unstable: `changing-${callCount}`, // Never stabilizes
      };
    };

    const result = await pollUntilConverged(getter, {
      fieldIds: ['stable', 'unstable'],
      stablePolls: 3,
      initialIntervalMs: 10,
      maxIntervalMs: 10,
      timeoutMs: 200,
    });

    expect(result.converged).toBe(false);
    expect(result.pendingFields).toContain('unstable');
    expect(result.pendingFields).not.toContain('stable');
  });
});

// ─── Timeout behavior ───────────────────────────────────────

describe('Timeout behavior', () => {
  test('returns partial results on timeout', async () => {
    let callCount = 0;
    const getter: FieldValueGetter = async (fieldIds) => {
      callCount++;
      return { field: `value-${callCount}` }; // Always changing
    };

    const result = await pollUntilConverged(getter, {
      fieldIds: ['field'],
      stablePolls: 3,
      initialIntervalMs: 10,
      maxIntervalMs: 10,
      timeoutMs: 150,
    });

    expect(result.converged).toBe(false);
    expect(result.pendingFields).toEqual(['field']);
    expect(result.values.field).toBeDefined(); // Has last-seen value
    expect(result.elapsedMs).toBeGreaterThanOrEqual(100);
    expect(result.pollCount).toBeGreaterThan(1);
  });

  test('respects short timeout', async () => {
    const start = Date.now();
    let callCount = 0;
    const getter: FieldValueGetter = async () => {
      callCount++;
      return { f: `v${callCount}` };
    };

    const result = await pollUntilConverged(getter, {
      fieldIds: ['f'],
      stablePolls: 3,
      initialIntervalMs: 50,
      timeoutMs: 100,
    });

    expect(result.converged).toBe(false);
    expect(Date.now() - start).toBeLessThan(500);
  });
});

// ─── Adaptive backoff ───────────────────────────────────────

describe('Adaptive backoff', () => {
  test('polling interval increases over time', async () => {
    const timestamps: number[] = [];
    const getter: FieldValueGetter = async (fieldIds) => {
      timestamps.push(Date.now());
      return { f: 'stable' };
    };

    await pollUntilConverged(getter, {
      fieldIds: ['f'],
      stablePolls: 5,
      initialIntervalMs: 20,
      maxIntervalMs: 100,
      timeoutMs: 2000,
    });

    // Check that later gaps are larger than earlier ones
    if (timestamps.length >= 4) {
      const earlyGap = timestamps[2] - timestamps[1];
      const lateGap = timestamps[timestamps.length - 1] - timestamps[timestamps.length - 2];
      expect(lateGap).toBeGreaterThanOrEqual(earlyGap);
    }
  });
});

// ─── Null value handling ────────────────────────────────────

describe('Null value handling', () => {
  test('null values are valid and can converge', async () => {
    const getter = mockGetter([
      { field: null },
      { field: null },
      { field: null },
    ]);

    const result = await pollUntilConverged(getter, {
      fieldIds: ['field'],
      stablePolls: 3,
      initialIntervalMs: 10,
      maxIntervalMs: 10,
      timeoutMs: 1000,
    });

    expect(result.converged).toBe(true);
    expect(result.values.field).toBeNull();
  });

  test('transition from null to value is detected', async () => {
    const getter = mockGetter([
      { field: null },
      { field: 'sourced' },
      { field: 'sourced' },
      { field: 'sourced' },
    ]);

    const result = await pollUntilConverged(getter, {
      fieldIds: ['field'],
      stablePolls: 3,
      initialIntervalMs: 10,
      maxIntervalMs: 10,
      timeoutMs: 1000,
    });

    expect(result.converged).toBe(true);
    expect(result.values.field).toBe('sourced');
  });
});
