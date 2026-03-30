/**
 * ns save — save the current record with full error detection.
 *
 * Clicks the NetSuite save button, then monitors for:
 *   - URL change (redirect after save → success with ?id=)
 *   - Native browser dialogs (validation / concurrency alerts)
 *   - DOM-based error modals (.uir-message-error, #_err_alert)
 *   - Timeout (page didn't respond within deadline)
 *
 * All error types are classified into the NsError taxonomy so the
 * agent gets structured, actionable feedback.
 */

import type { BrowserManager } from '../../core/browser-manager';
import type { NsMetadata } from '../../core/activity';
import type { NsCommandOutput } from '../format';
import { formatNsError } from '../format';
import {
  guardNsApi,
  saveTimeout,
  classifyMessage,
  type NsResult,
} from '../errors';
import { withDialogHandler, detectDomModal, type CapturedDialog } from '../utils/with-dialog-handler';
import { waitForSettle } from '../utils/with-retry';
import { withMutex, nsMutex } from '../mutex';

// ─── Types ────────────────────────────────────────────────

export interface NsSaveData {
  saved: boolean;
  recordId?: string;
  url: string;
  dialogs: CapturedDialog[];
}

// ─── Helpers ──────────────────────────────────────────────

const SAVE_TIMEOUT_MS = 30_000;

/** Extract the record id from a URL query string (?id=123) */
function extractRecordId(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('id');
  } catch {
    // Relative URL or malformed — try regex
    const match = url.match(/[?&]id=(\d+)/);
    return match ? match[1] : null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── ns save ──────────────────────────────────────────────

export async function nsSave(args: string[], bm: BrowserManager): Promise<NsCommandOutput> {
  const result = await withMutex(nsMutex, async (): Promise<NsResult<NsSaveData>> => {
      const start = Date.now();
      const target = bm.getActiveFrameOrPage();

      // Guard: must be on a NS page with client API
      const guardErr = await guardNsApi(target);
      if (guardErr) {
        return { ok: false as const, error: guardErr };
      }

      const page = bm.getPage();
      const urlBeforeSave = page.url();

      // Locate the NS save button before wrapping in dialog handler
      const saveSelector = '#btn_multibutton_submitter, #submitter, [id*="submitter"]';
      const saveBtn = await page.$(saveSelector);

      if (!saveBtn) {
        return { ok: false as const, error: saveTimeout('Save button not found on page') };
      }

      // Use withDialogHandler to capture dialogs during the save operation.
      // Must use Playwright's native click (not JS .click()) to dispatch a
      // trusted mouse event — inline onclick handlers that trigger navigation
      // only work with trusted events.
      const { result: _saveTriggered, dialogs } = await withDialogHandler(
        bm,
        async (): Promise<boolean> => {
          await saveBtn.click({ noWaitAfter: true });
          return true;
        },
        { accept: true },
      );

      // ── Wait for result: URL change, dialog, or DOM modal ──
      //
      // Order matters: dialogs and URL checks are safe during navigation
      // (no page.evaluate), so check those first. DOM modal detection
      // requires evaluate and may throw if the page is mid-navigation —
      // wrap in try/catch and retry on next loop iteration.

      const deadline = start + SAVE_TIMEOUT_MS;

      while (Date.now() < deadline) {
        // 1. Check for captured dialogs (validation / concurrency alerts)
        //    Dialogs are captured synchronously — no evaluate needed.
        if (dialogs.length > 0) {
          const lastMessage = dialogs[dialogs.length - 1].message;
          const classified = classifyMessage(lastMessage);
          if (classified) {
            return { ok: false as const, error: classified, dialogs };
          }
          // Unclassified dialog — treat as informational, keep waiting
        }

        // 2. Check if URL changed (redirect after save) — safe during nav
        const currentUrl = page.url();
        if (currentUrl !== urlBeforeSave) {
          const recordId = extractRecordId(currentUrl);
          if (recordId) {
            return { ok: true as const, data: { saved: true, recordId, url: currentUrl, dialogs }, dialogs };
          }

          // URL changed but no ?id= — wait for page to settle, then check
          try {
            await waitForSettle(page, { timeoutMs: 3000, stableMs: 500 });
            const postRedirectModal = await detectDomModal(page);
            if (postRedirectModal) {
              const classified = classifyMessage(postRedirectModal.message);
              if (classified) {
                return { ok: false as const, error: classified, dialogs };
              }
            }
          } catch {
            // Page still navigating — ignore, will retry
          }

          // URL changed, no id, no error — treat as success (some saves don't have ?id=)
          return { ok: true as const, data: { saved: true, url: currentUrl, dialogs }, dialogs };
        }

        // 3. Check for DOM-based error modals (requires evaluate — may throw during nav)
        try {
          const domModal = await detectDomModal(page);
          if (domModal) {
            const classified = classifyMessage(domModal.message);
            if (classified) {
              return { ok: false as const, error: classified, dialogs };
            }
          }
        } catch {
          // Page navigating — DOM not accessible, will retry next iteration
        }

        // 4. Brief pause before polling again
        await sleep(300);
      }

      // ── Timeout ──
      return { ok: false as const, error: saveTimeout(`Save did not complete within ${SAVE_TIMEOUT_MS}ms`), dialogs };
    }, { label: 'ns save', operationTimeoutMs: SAVE_TIMEOUT_MS + 5_000 });

  if (!result.ok) {
    const lines = [formatNsError('ns save', result.error!)];
    if (result.dialogs?.length) {
      for (const dl of result.dialogs) {
        lines.push(`Dialog (${dl.type}): ${dl.message}`);
      }
    }
    return { display: lines.join('\n'), ok: false };
  }

  const d = result.data!;
  const parts = ['SAVE OK'];
  if (d.recordId) parts.push(`Record: ${d.recordId}`);
  parts.push(d.url);

  const metadata: NsMetadata = {};
  if (d.recordId) metadata.recordId = d.recordId;
  if (/_SB\d*/i.test(d.url) || /sandbox/i.test(d.url)) {
    metadata.environment = 'sandbox';
  } else if (d.url.startsWith('http')) {
    metadata.environment = 'production';
  }

  return {
    display: parts.join(' | '),
    ok: true,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}
