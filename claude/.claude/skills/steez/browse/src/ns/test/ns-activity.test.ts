/**
 * Tests for NS metadata extraction in the activity stream.
 *
 * Verifies that extractNsMetadata correctly parses NsCommandResult JSON
 * to extract recordType, recordId, and environment for activity entries.
 */

import { describe, test, expect } from 'bun:test';
import { extractNsMetadata } from '../ns-metadata';
import { emitActivity, getActivityHistory } from '../../core/activity';

// ─── extractNsMetadata ─────────────────────────────────────────

describe('extractNsMetadata', () => {
  test('extracts recordType from ns navigate result', () => {
    const result = JSON.stringify({
      ok: true,
      data: {
        url: 'https://12345.app.netsuite.com/app/accounting/transactions/salesord.nl',
        recordType: 'salesorder',
        mode: 'edit',
        sessionValid: true,
      },
      elapsedMs: 1200,
    });

    const meta = extractNsMetadata(result);
    expect(meta).toBeDefined();
    expect(meta!.recordType).toBe('salesorder');
    expect(meta!.environment).toBe('production');
  });

  test('extracts recordId from ns save result', () => {
    const result = JSON.stringify({
      ok: true,
      data: {
        saved: true,
        recordId: '42',
        url: 'https://12345.app.netsuite.com/app/accounting/transactions/salesord.nl?id=42',
        dialogs: [],
      },
      elapsedMs: 3500,
    });

    const meta = extractNsMetadata(result);
    expect(meta).toBeDefined();
    expect(meta!.recordId).toBe('42');
    expect(meta!.environment).toBe('production');
  });

  test('extracts recordId from URL ?id= when not in data.recordId', () => {
    const result = JSON.stringify({
      ok: true,
      data: {
        url: 'https://12345.app.netsuite.com/app/accounting/transactions/salesord.nl?id=789',
        recordType: 'salesorder',
        mode: 'view',
        sessionValid: true,
      },
      elapsedMs: 800,
    });

    const meta = extractNsMetadata(result);
    expect(meta).toBeDefined();
    expect(meta!.recordId).toBe('789');
    expect(meta!.recordType).toBe('salesorder');
  });

  test('detects sandbox environment from _SB suffix in URL', () => {
    const result = JSON.stringify({
      ok: true,
      data: {
        url: 'https://12345_SB1.app.netsuite.com/app/accounting/transactions/salesord.nl',
        recordType: 'salesorder',
        mode: 'edit',
        sessionValid: true,
      },
      elapsedMs: 900,
    });

    const meta = extractNsMetadata(result);
    expect(meta).toBeDefined();
    expect(meta!.environment).toBe('sandbox');
  });

  test('detects sandbox environment from sandbox subdomain', () => {
    const result = JSON.stringify({
      ok: true,
      data: {
        url: 'https://12345.sandbox.netsuite.com/app/accounting/transactions/salesord.nl',
        recordType: 'salesorder',
        mode: 'edit',
        sessionValid: true,
      },
      elapsedMs: 700,
    });

    const meta = extractNsMetadata(result);
    expect(meta).toBeDefined();
    expect(meta!.environment).toBe('sandbox');
  });

  test('detects environment from ns login account field', () => {
    const result = JSON.stringify({
      ok: true,
      data: {
        loggedIn: true,
        account: '12345_SB2',
        url: 'https://12345_SB2.app.netsuite.com/app/center/card.nl',
      },
      elapsedMs: 5000,
    });

    const meta = extractNsMetadata(result);
    expect(meta).toBeDefined();
    expect(meta!.environment).toBe('sandbox');
  });

  test('extracts recordType from ns status result', () => {
    const result = JSON.stringify({
      ok: true,
      data: {
        url: 'https://12345.app.netsuite.com/app/common/entity/custjob.nl?id=100',
        recordType: 'customer',
        mode: 'view',
        sessionValid: true,
        modal: null,
      },
      elapsedMs: 200,
    });

    const meta = extractNsMetadata(result);
    expect(meta).toBeDefined();
    expect(meta!.recordType).toBe('customer');
    expect(meta!.recordId).toBe('100');
    expect(meta!.environment).toBe('production');
  });

  test('returns undefined for failed NS command with no data', () => {
    const result = JSON.stringify({
      ok: false,
      error: {
        type: 'ValidationError',
        message: 'Missing record type',
        recoverable: true,
        suggestedAction: 'Fix the invalid field value and retry',
      },
      elapsedMs: 5,
    });

    const meta = extractNsMetadata(result);
    expect(meta).toBeUndefined();
  });

  test('returns undefined for malformed JSON', () => {
    const meta = extractNsMetadata('not valid json {{{');
    expect(meta).toBeUndefined();
  });

  test('returns undefined for non-NS result (no data or ok)', () => {
    const meta = extractNsMetadata(JSON.stringify({ error: 'something went wrong' }));
    expect(meta).toBeUndefined();
  });

  test('returns undefined when data has no extractable fields', () => {
    const result = JSON.stringify({
      ok: true,
      data: {
        fieldId: 'memo',
        value: 'test memo',
        cascading: 'suppressed',
        settled: true,
        elapsedMs: 50,
        diff: { changed: [] },
        dialogs: [],
      },
      elapsedMs: 50,
    });

    // ns set result without a URL — no recordType, recordId, or environment extractable
    const meta = extractNsMetadata(result);
    expect(meta).toBeUndefined();
  });
});

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
    // Emit an NS activity entry with metadata
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
