/**
 * ns status — report current page state.
 *
 * Returns: record type (detected from URL), form mode, session validity,
 * and any visible DOM modals. No args needed.
 */

import type { BrowserManager } from '../../core/browser-manager';
import { guardNsApi, detectSessionExpiry, nsOk, nsFail, type NsCommandResult } from '../errors';
import { detectFormMode, type NsFormMode } from '../utils/introspect-field';
import { detectDomModal, type DomModal } from '../utils/with-dialog-handler';
import { withMutex, nsMutex } from '../mutex';
import { RECORD_URL_MAP } from '../tier1';

// ─── URL → Record Type Detection ───────────────────────────

/**
 * Parse the current URL against RECORD_URL_MAP slugs to detect the record type.
 * Returns the record type key (e.g. 'salesorder') or null if unrecognized.
 */
function detectRecordTypeFromUrl(url: string): string | null {
  const pathname = url.split('?')[0].toLowerCase();

  for (const [recordType, slug] of Object.entries(RECORD_URL_MAP.transactions)) {
    if (pathname.includes(`/${slug}.nl`)) return recordType;
  }

  for (const [recordType, slug] of Object.entries(RECORD_URL_MAP.entities)) {
    if (pathname.includes(`/${slug}.nl`)) return recordType;
  }

  return null;
}

// ─── ns status ─────────────────────────────────────────────

export interface NsStatusData {
  url: string;
  recordType: string | null;
  mode: NsFormMode;
  sessionValid: boolean;
  modal: DomModal | null;
}

export async function nsStatus(args: string[], bm: BrowserManager): Promise<string> {
  return JSON.stringify(
    await withMutex(nsMutex, async (): Promise<NsCommandResult<NsStatusData>> => {
      const start = Date.now();
      const target = bm.getActiveFrameOrPage();

      // Guard: must be on a NS page with client API
      const guardErr = await guardNsApi(target);
      if (guardErr) {
        return nsFail(guardErr, Date.now() - start);
      }

      // Check session expiry
      const sessionErr = await detectSessionExpiry(target);
      if (sessionErr) {
        return nsFail(sessionErr, Date.now() - start);
      }

      // Gather page state
      const url = bm.getCurrentUrl();
      const recordType = detectRecordTypeFromUrl(url);
      const mode = await detectFormMode(target);
      const modal = await detectDomModal(target);

      return nsOk<NsStatusData>(
        { url, recordType, mode, sessionValid: true, modal },
        Date.now() - start,
      );
    }, { label: 'ns status' }),
  );
}
