/**
 * NsCommandOutput return type and error formatting for NS commands.
 *
 * Each NS command converts its internal NsCommandResult<T> into an
 * NsCommandOutput — plain-text display for the HTTP response, a boolean
 * ok flag for status tracking, and optional NsMetadata for the activity
 * stream. This replaces the previous JSON.stringify → extractNsMetadata
 * round-trip.
 *
 * Error formatting is centralised here via formatNsError() so every
 * command produces consistent, readable error output. Success formatting
 * is command-specific (each command knows what its data means).
 */

import type { NsError } from './errors';
import type { NsMetadata } from '../core/activity';

// ─── Return Type ───────────────────────────────────────────

export interface NsCommandOutput {
  /** Human-readable plain text for the HTTP response body */
  display: string;
  /** Whether the command succeeded */
  ok: boolean;
  /** NS-specific metadata for the activity stream (record type, id, environment) */
  metadata?: NsMetadata;
}

// ─── Error Formatting ──────────────────────────────────────

/**
 * Convert an NsError into readable plain-text lines.
 *
 * Output format:
 *   ✗ ns save failed: Please enter a value for Company Name
 *     Type: ValidationError (recoverable)
 *     → Fix the invalid field value and retry the operation
 *
 * elapsedMs is intentionally omitted — timing belongs in the activity
 * stream, not in agent-facing output where it wastes tokens.
 */
export function formatNsError(commandName: string, error: NsError): string {
  const recoverableLabel = error.recoverable ? 'recoverable' : 'not recoverable';
  return [
    `✗ ${commandName} failed: ${error.message}`,
    `  Type: ${error.type} (${recoverableLabel})`,
    `  → ${error.suggestedAction}`,
  ].join('\n');
}
