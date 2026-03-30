/**
 * ns status — report current page state.
 *
 * Returns: record type (detected from URL), form mode, session validity,
 * and any visible DOM modals. No args needed.
 */

import type { BrowserManager } from '../../core/browser-manager';
import type { NsMetadata } from '../../core/activity';
import type { NsCommandOutput } from '../format';
import { formatNsError } from '../format';
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

export async function nsStatus(args: string[], bm: BrowserManager): Promise<NsCommandOutput> {
  const result = await withMutex(nsMutex, async (): Promise<NsCommandResult<NsStatusData>> => {
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
  }, { label: 'ns status' });

  if (!result.ok) {
    return { display: formatNsError('ns status', result.error!), ok: false };
  }

  const d = result.data!;
  const recordLabel = d.recordType ?? 'unknown';
  const lines = [`STATUS OK | ${recordLabel} (${d.mode}) | Session valid`];
  if (d.modal) {
    lines.push(`Modal: ${d.modal.type} — ${d.modal.message}`);
  }

  const metadata: NsMetadata = {};
  if (d.recordType) metadata.recordType = d.recordType;
  const idMatch = d.url.match(/[?&]id=(\d+)/);
  if (idMatch) metadata.recordId = idMatch[1];
  if (/_SB\d*/i.test(d.url) || /sandbox/i.test(d.url)) {
    metadata.environment = 'sandbox';
  } else if (d.url.startsWith('http')) {
    metadata.environment = 'production';
  }

  return {
    display: lines.join('\n'),
    ok: true,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}
