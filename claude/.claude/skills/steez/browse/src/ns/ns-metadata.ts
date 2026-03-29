/**
 * NS metadata extraction for the activity stream.
 *
 * Parses the JSON result of an NS command and extracts structured metadata
 * (recordType, recordId, environment) for inclusion in activity entries.
 * This lets external tools monitoring the SSE activity stream track
 * NS-specific operations without parsing raw command output.
 */

import type { NsMetadata } from '../core/activity';

/**
 * Extract NS-specific metadata from an NS command result JSON string.
 *
 * NS commands return NsCommandResult<T> where T.data may contain:
 *   - recordType (ns navigate, ns status)
 *   - recordId (ns save, ns navigate via URL ?id=)
 *   - url (most commands — used to detect environment: production vs sandbox)
 *
 * Returns undefined if no NS metadata could be extracted.
 */
export function extractNsMetadata(resultJson: string): NsMetadata | undefined {
  try {
    const parsed = JSON.parse(resultJson);
    const data = parsed?.data;
    if (!data && !parsed?.ok) return undefined;

    const meta: NsMetadata = {};

    // recordType: directly on data (ns navigate, ns status)
    if (data?.recordType) {
      meta.recordType = data.recordType;
    }

    // recordId: directly on data (ns save), or from URL ?id= param
    if (data?.recordId) {
      meta.recordId = data.recordId;
    } else if (data?.url) {
      const idMatch = data.url.match(/[?&]id=(\d+)/);
      if (idMatch) {
        meta.recordId = idMatch[1];
      }
    }

    // environment: detect from URL — _SB suffix in account ID or sandbox subdomain
    const url: string | undefined = data?.url || data?.account;
    if (url) {
      if (/_SB\d*/i.test(url) || /sandbox/i.test(url)) {
        meta.environment = 'sandbox';
      } else if (url.startsWith('http')) {
        meta.environment = 'production';
      }
    }

    // Only return if we extracted at least one field
    if (meta.recordType || meta.recordId || meta.environment) {
      return meta;
    }
  } catch {
    // Malformed JSON — skip metadata extraction
  }
  return undefined;
}
