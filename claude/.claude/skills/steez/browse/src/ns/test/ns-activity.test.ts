/**
 * Tests for NS metadata in the activity stream.
 *
 * Verifies that emitActivity correctly includes nsMetadata when provided
 * and that it appears in activity history.
 */

import { describe, test, expect } from 'bun:test';
import { emitActivity, getActivityHistory } from '../../core/activity';

// ─── Activity integration ───────────────────────────────────────

describe('activity entry with nsMetadata', () => {
  test('emitActivity includes nsMetadata when provided', () => {
    const entry = emitActivity({
      type: 'command_end',
      command: 'ns',
      args: ['navigate', 'salesorder'],
      status: 'ok',
      result: '{}',
      nsMetadata: {
        recordType: 'salesorder',
        environment: 'production',
      },
    });

    expect(entry.nsMetadata).toBeDefined();
    expect(entry.nsMetadata!.recordType).toBe('salesorder');
    expect(entry.nsMetadata!.environment).toBe('production');
    expect(entry.nsMetadata!.recordId).toBeUndefined();
  });

  test('emitActivity omits nsMetadata for non-NS commands', () => {
    const entry = emitActivity({
      type: 'command_end',
      command: 'navigate',
      args: ['https://example.com'],
      status: 'ok',
      result: '{}',
    });

    expect(entry.nsMetadata).toBeUndefined();
  });

  test('nsMetadata appears in activity history', () => {
    emitActivity({
      type: 'command_end',
      command: 'ns',
      args: ['save'],
      status: 'ok',
      result: '{}',
      nsMetadata: {
        recordType: 'salesorder',
        recordId: '42',
        environment: 'sandbox',
      },
    });

    const { entries } = getActivityHistory(10);
    const nsEntry = entries.find(
      e => e.command === 'ns' && e.nsMetadata?.recordId === '42',
    );

    expect(nsEntry).toBeDefined();
    expect(nsEntry!.nsMetadata!.recordType).toBe('salesorder');
    expect(nsEntry!.nsMetadata!.recordId).toBe('42');
    expect(nsEntry!.nsMetadata!.environment).toBe('sandbox');
  });
});
