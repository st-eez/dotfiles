/**
 * Unit tests for NsCommandOutput type and formatNsError helper.
 */

import { describe, test, expect } from 'bun:test';
import { formatNsError, type NsCommandOutput } from '../format';
import {
  validationError,
  concurrencyError,
  sessionExpired,
  saveTimeout,
  notARecordPage,
} from '../errors';

// ─── formatNsError ─────────────────────────────────────────

describe('formatNsError', () => {
  test('formats a recoverable validation error', () => {
    const err = validationError('Please enter a value for Company Name');
    const output = formatNsError('ns save', err);

    expect(output).toContain('✗ ns save failed: Please enter a value for Company Name');
    expect(output).toContain('Type: ValidationError (recoverable)');
    expect(output).toContain('→ Fix the invalid field value and retry the operation');
  });

  test('formats a recoverable concurrency error', () => {
    const err = concurrencyError('Record has been changed by another user');
    const output = formatNsError('ns save', err);

    expect(output).toContain('✗ ns save failed: Record has been changed by another user');
    expect(output).toContain('(recoverable)');
    expect(output).toContain('ConcurrencyError');
  });

  test('formats a non-recoverable session expired error', () => {
    const err = sessionExpired('Session timed out');
    const output = formatNsError('ns status', err);

    expect(output).toContain('✗ ns status failed: Session timed out');
    expect(output).toContain('(not recoverable)');
    expect(output).toContain('SessionExpired');
  });

  test('formats a save timeout error', () => {
    const err = saveTimeout('Save did not complete within 30000ms');
    const output = formatNsError('ns save', err);

    expect(output).toContain('SaveTimeout');
    expect(output).toContain('(recoverable)');
  });

  test('formats a not-a-record-page error', () => {
    const err = notARecordPage('NetSuite client API not available');
    const output = formatNsError('ns inspect', err);

    expect(output).toContain('✗ ns inspect failed');
    expect(output).toContain('NotARecordPage');
    expect(output).toContain('(not recoverable)');
  });

  test('does not include elapsedMs', () => {
    const err = validationError('bad value');
    const output = formatNsError('ns set', err);

    expect(output).not.toContain('elapsed');
    expect(output).not.toContain('Ms');
    expect(output).not.toContain('ms');
  });

  test('output is exactly 3 lines', () => {
    const err = validationError('test');
    const output = formatNsError('ns save', err);
    const lines = output.split('\n');

    expect(lines).toHaveLength(3);
  });

  test('preserves the command name for any ns command', () => {
    const err = notARecordPage('not on record page');

    for (const cmd of ['ns navigate', 'ns query', 'ns set', 'ns add-row', 'ns verify']) {
      const output = formatNsError(cmd, err);
      expect(output).toStartWith(`✗ ${cmd} failed:`);
    }
  });
});

// ─── NsCommandOutput shape ─────────────────────────────────

describe('NsCommandOutput', () => {
  test('success output has display + ok + optional metadata', () => {
    const output: NsCommandOutput = {
      display: 'Navigated to Sales Order #12345',
      ok: true,
      metadata: { recordType: 'salesorder', recordId: '12345', environment: 'sandbox' },
    };

    expect(output.display).toBe('Navigated to Sales Order #12345');
    expect(output.ok).toBe(true);
    expect(output.metadata?.recordType).toBe('salesorder');
  });

  test('error output has display + ok=false, metadata optional', () => {
    const err = validationError('Field required');
    const output: NsCommandOutput = {
      display: formatNsError('ns save', err),
      ok: false,
    };

    expect(output.ok).toBe(false);
    expect(output.display).toContain('✗ ns save failed');
    expect(output.metadata).toBeUndefined();
  });

  test('metadata is omissible', () => {
    const output: NsCommandOutput = {
      display: 'Query returned 5 rows',
      ok: true,
    };

    expect(output.metadata).toBeUndefined();
  });
});
