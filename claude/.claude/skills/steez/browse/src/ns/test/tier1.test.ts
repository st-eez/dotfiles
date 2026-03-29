/**
 * Unit tests for Tier 1 universal NS knowledge constants.
 *
 * Validates structure, completeness, and invariants of the hardcoded
 * platform facts. These tests ensure the constants remain well-formed
 * as they're referenced by downstream NS commands.
 */

import { describe, test, expect } from 'bun:test';
import {
  ENTITY_REF_SOURCING,
  RATE_PRICING,
  PO_LINE_LOCATION,
  DIALOG_PATTERNS,
  STANDARD_SUBLISTS,
  RECORD_URL_MAP,
} from '../tier1';

// ─── Entity-Ref Sourcing ────────────────────────────────────

describe('ENTITY_REF_SOURCING', () => {
  test('has required shape', () => {
    expect(typeof ENTITY_REF_SOURCING.reason).toBe('string');
    expect(ENTITY_REF_SOURCING.suppressCascade).toBe(false);
    expect(ENTITY_REF_SOURCING.settleRange.minMs).toBeLessThan(ENTITY_REF_SOURCING.settleRange.maxMs);
  });

  test('settle range is reasonable', () => {
    expect(ENTITY_REF_SOURCING.settleRange.minMs).toBeGreaterThanOrEqual(100);
    expect(ENTITY_REF_SOURCING.settleRange.maxMs).toBeLessThanOrEqual(30_000);
  });

  test('common triggers are non-empty', () => {
    expect(ENTITY_REF_SOURCING.commonTriggers.length).toBeGreaterThan(0);
    for (const trigger of ENTITY_REF_SOURCING.commonTriggers) {
      expect(typeof trigger).toBe('string');
      expect(trigger.length).toBeGreaterThan(0);
    }
  });
});

// ─── Rate/Pricing Independence ──────────────────────────────

describe('RATE_PRICING', () => {
  test('has required shape', () => {
    expect(typeof RATE_PRICING.reason).toBe('string');
    expect(RATE_PRICING.alwaysReadActual).toBe(true);
    expect(RATE_PRICING.requiresSettleAfterItemSet).toBe(true);
  });
});

// ─── PO Line Location ───────────────────────────────────────

describe('PO_LINE_LOCATION', () => {
  test('header does not cascade to lines', () => {
    expect(PO_LINE_LOCATION.headerCascadesToLines).toBe(false);
  });

  test('line field ID is specified', () => {
    expect(PO_LINE_LOCATION.lineFieldId).toBe('location');
  });
});

// ─── Dialog Patterns ────────────────────────────────────────

describe('DIALOG_PATTERNS', () => {
  test('informational types include alert', () => {
    expect(DIALOG_PATTERNS.informational.types).toContain('alert');
  });

  test('blocking types include confirm and beforeunload', () => {
    expect(DIALOG_PATTERNS.blocking.types).toContain('confirm');
    expect(DIALOG_PATTERNS.blocking.types).toContain('beforeunload');
  });

  test('message patterns are valid regexes', () => {
    for (const pattern of DIALOG_PATTERNS.informational.messagePatterns) {
      expect(pattern).toBeInstanceOf(RegExp);
    }
    for (const pattern of DIALOG_PATTERNS.blocking.messagePatterns) {
      expect(pattern).toBeInstanceOf(RegExp);
    }
  });

  test('informational patterns match expected messages', () => {
    const patterns = DIALOG_PATTERNS.informational.messagePatterns;
    expect(patterns.some(p => p.test('Record has been updated successfully'))).toBe(true);
    expect(patterns.some(p => p.test('Transaction saved'))).toBe(true);
  });

  test('blocking patterns match expected messages', () => {
    const patterns = DIALOG_PATTERNS.blocking.messagePatterns;
    expect(patterns.some(p => p.test('Are you sure you want to leave?'))).toBe(true);
    expect(patterns.some(p => p.test('This record has been changed by another user'))).toBe(true);
  });

  test('DOM error selectors are non-empty strings', () => {
    expect(DIALOG_PATTERNS.domErrorSelectors.length).toBeGreaterThan(0);
    for (const sel of DIALOG_PATTERNS.domErrorSelectors) {
      expect(typeof sel).toBe('string');
      expect(sel.length).toBeGreaterThan(0);
    }
  });
});

// ─── Standard Sublists ──────────────────────────────────────

describe('STANDARD_SUBLISTS', () => {
  test('has entries for common record types', () => {
    const types = Object.keys(STANDARD_SUBLISTS.byRecordType);
    expect(types).toContain('salesorder');
    expect(types).toContain('purchaseorder');
    expect(types).toContain('invoice');
    expect(types).toContain('customer');
    expect(types).toContain('vendor');
    expect(types).toContain('employee');
  });

  test('every record type has at least one sublist', () => {
    for (const [type, sublists] of Object.entries(STANDARD_SUBLISTS.byRecordType)) {
      expect(sublists.length).toBeGreaterThan(0);
      // @ts-expect-error — type is string, sublists is readonly
      for (const sublist of sublists) {
        expect(typeof sublist).toBe('string');
      }
    }
  });

  test('transaction records include item sublist', () => {
    const transactionTypes = ['salesorder', 'purchaseorder', 'invoice', 'vendorbill'] as const;
    for (const type of transactionTypes) {
      expect(STANDARD_SUBLISTS.byRecordType[type]).toContain('item');
    }
  });

  test('entity records include addressbook', () => {
    const entityTypes = ['customer', 'vendor', 'employee'] as const;
    for (const type of entityTypes) {
      expect(STANDARD_SUBLISTS.byRecordType[type]).toContain('addressbook');
    }
  });
});

// ─── Record URL Map ─────────────────────────────────────────

describe('RECORD_URL_MAP', () => {
  test('transaction slugs are non-empty strings', () => {
    for (const [type, slug] of Object.entries(RECORD_URL_MAP.transactions)) {
      expect(typeof slug).toBe('string');
      expect(slug.length).toBeGreaterThan(0);
    }
  });

  test('entity slugs are non-empty strings', () => {
    for (const [type, slug] of Object.entries(RECORD_URL_MAP.entities)) {
      expect(typeof slug).toBe('string');
      expect(slug.length).toBeGreaterThan(0);
    }
  });

  test('buildUrl generates correct transaction URL', () => {
    const url = RECORD_URL_MAP.buildUrl('salesorder', 123, true);
    expect(url).toBe('/app/accounting/transactions/salesord.nl?id=123&e=T');
  });

  test('buildUrl generates correct entity URL', () => {
    const url = RECORD_URL_MAP.buildUrl('customer', 456);
    expect(url).toBe('/app/common/entity/custjob.nl?id=456');
  });

  test('buildUrl generates new record URL (no id)', () => {
    const url = RECORD_URL_MAP.buildUrl('salesorder');
    expect(url).toBe('/app/accounting/transactions/salesord.nl');
  });

  test('buildUrl falls back to custom record pattern', () => {
    const url = RECORD_URL_MAP.buildUrl('myrecord', 789);
    expect(url).toBe('/app/common/custom/custrecordmyrecord.nl?id=789');
  });

  test('covers all standard sublist record types', () => {
    const sublistTypes = Object.keys(STANDARD_SUBLISTS.byRecordType);
    const urlTypes = [
      ...Object.keys(RECORD_URL_MAP.transactions),
      ...Object.keys(RECORD_URL_MAP.entities),
    ];
    // Every record type with sublists should have a URL mapping
    for (const type of sublistTypes) {
      expect(urlTypes).toContain(type);
    }
  });
});
