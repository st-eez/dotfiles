/**
 * Typed error taxonomy + recovery model for NS commands.
 *
 * Every NS command error is one of 5 typed classes. Each carries:
 *   - type: discriminant for switch/match
 *   - recoverable: can the agent retry or must the human intervene?
 *   - suggestedAction: plain-English guidance for the agent
 */

import type { Page, Frame } from 'playwright';
import type { CapturedDialog } from './utils/with-dialog-handler';

// ─── Error Types ────────────────────────────────────────────

export type NsErrorType =
  | 'ValidationError'
  | 'ConcurrencyError'
  | 'SessionExpired'
  | 'SaveTimeout'
  | 'NotARecordPage';

export interface NsError {
  type: NsErrorType;
  message: string;
  recoverable: boolean;
  suggestedAction: string;
}

// ─── Error Constructors ─────────────────────────────────────

export function validationError(message: string): NsError {
  return {
    type: 'ValidationError',
    message,
    recoverable: true,
    suggestedAction: 'Fix the invalid field value and retry the operation',
  };
}

export function concurrencyError(message: string): NsError {
  return {
    type: 'ConcurrencyError',
    message,
    recoverable: true,
    suggestedAction: 'Reload the record to get the latest version, re-apply changes, then retry',
  };
}

export function sessionExpired(message: string): NsError {
  return {
    type: 'SessionExpired',
    message,
    recoverable: false,
    suggestedAction: 'Session has expired — navigate to NetSuite login page and re-authenticate',
  };
}

export function saveTimeout(message: string): NsError {
  return {
    type: 'SaveTimeout',
    message,
    recoverable: true,
    suggestedAction: 'Check if the record was saved (look for ?id= in URL), then retry if needed',
  };
}

export function notARecordPage(message: string): NsError {
  return {
    type: 'NotARecordPage',
    message,
    recoverable: false,
    suggestedAction: 'Navigate to a NetSuite record page before running NS commands',
  };
}

// ─── Internal Result Type ──────────────────────────────────
// Lean discriminated union for command internals. Commands convert
// NsResult into NsCommandOutput (plain text) before returning.

export type NsResult<T = unknown> =
  | { ok: true; data: T; dialogs?: CapturedDialog[] }
  | { ok: false; error: NsError; dialogs?: CapturedDialog[] };

// ─── NS API Availability Guard ──────────────────────────────

/**
 * Check that the NetSuite client-side API is available on the current page.
 * Returns null if available, or a NotARecordPage error if not.
 *
 * Must be called before any NS command that uses nlapiGetField, nlapiSetFieldValue, etc.
 */
export async function guardNsApi(target: Page | Frame): Promise<NsError | null> {
  const available = await target.evaluate(() => {
    return typeof (window as any).nlapiGetField === 'function';
  });

  if (!available) {
    return notARecordPage('NetSuite client API (nlapiGetField) not available on this page');
  }
  return null;
}

// ─── Session Expiry Detection ───────────────────────────────

/**
 * Check if the current page indicates an expired NetSuite session.
 * NS redirects to login page or shows session timeout message.
 */
export async function detectSessionExpiry(target: Page | Frame): Promise<NsError | null> {
  const expired = await target.evaluate(() => {
    const url = window.location.href;

    // Login page redirect
    if (/\/pages\/customerlogin/i.test(url) || /\/app\/login/i.test(url)) {
      return 'Redirected to login page';
    }

    // Session timeout message in page
    const body = document.body?.innerText ?? '';
    if (/session has (timed out|expired)/i.test(body)) {
      return 'Session timeout detected';
    }
    if (/please log in again/i.test(body)) {
      return 'Re-login required';
    }

    return null;
  });

  return expired ? sessionExpired(expired) : null;
}

// ─── Concurrency Detection ──────────────────────────────────

/**
 * Check if a dialog or DOM message indicates a concurrency conflict.
 * Returns a ConcurrencyError if detected, null otherwise.
 */
export function detectConcurrencyFromMessage(message: string): NsError | null {
  const patterns = [
    /record has been changed/i,
    /has been updated by/i,
    /another user has updated/i,
    /version conflict/i,
    /optimistic locking/i,
  ];

  if (patterns.some(p => p.test(message))) {
    return concurrencyError(message);
  }
  return null;
}

// ─── Validation Error Detection ─────────────────────────────

/**
 * Check if a dialog or DOM message indicates a validation error.
 */
export function detectValidationFromMessage(message: string): NsError | null {
  const patterns = [
    /please enter a value for/i,
    /invalid .* value/i,
    /field is required/i,
    /must be a number/i,
    /cannot be empty/i,
    /exceeds maximum length/i,
  ];

  if (patterns.some(p => p.test(message))) {
    return validationError(message);
  }
  return null;
}

// ─── Classify Dialog/DOM Message ────────────────────────────

/**
 * Given a dialog or DOM error message, classify it into a typed error.
 * Returns null if the message doesn't match any known error pattern
 * (may be informational).
 */
export function classifyMessage(message: string): NsError | null {
  return detectConcurrencyFromMessage(message)
    ?? detectValidationFromMessage(message)
    ?? null;
}
