/**
 * ns cancel — cancel the current record edit / clear current line.
 *
 * Calls window.nlapiCancel() if available, otherwise falls back to
 * clicking the Cancel button via DOM. Captures any "unsaved changes"
 * confirmation dialogs that fire during the operation.
 */

import type { BrowserManager } from '../../core/browser-manager';
import { guardNsApi, nsOk, nsFail, notARecordPage, type NsCommandResult } from '../errors';
import { withDialogHandler, type CapturedDialog } from '../utils/with-dialog-handler';
import { withMutex, nsMutex } from '../mutex';

// ─── ns cancel ─────────────────────────────────────────────

export interface NsCancelData {
  cancelled: boolean;
  dialogs: CapturedDialog[];
}

export async function nsCancel(args: string[], bm: BrowserManager): Promise<string> {
  return JSON.stringify(
    await withMutex(nsMutex, async (): Promise<NsCommandResult<NsCancelData>> => {
      const start = Date.now();
      const target = bm.getActiveFrameOrPage();

      // Guard: must be on a NS page with client API
      const guardErr = await guardNsApi(target);
      if (guardErr) {
        return nsFail(guardErr, Date.now() - start);
      }

      // Use withDialogHandler to capture any "unsaved changes" dialogs
      const { result: cancelled, dialogs } = await withDialogHandler(
        bm,
        async (): Promise<boolean> => {
          const page = bm.getPage();

          // Try nlapiCancel first (NS client API)
          const apiResult = await page.evaluate(() => {
            if (typeof (window as any).nlapiCancel === 'function') {
              try {
                (window as any).nlapiCancel();
                return { success: true };
              } catch (e: any) {
                return { success: false, error: e?.message ?? String(e) };
              }
            }
            return null; // nlapiCancel not available
          });

          if (apiResult !== null) {
            return apiResult.success;
          }

          // Fallback: click Cancel button via DOM
          const cancelBtn = await page.$('input[value="Cancel"], button:has-text("Cancel"), #btn_secondarymultibutton_submitter[value="Cancel"]');
          if (cancelBtn) {
            await cancelBtn.click();
            return true;
          }

          return false;
        },
        { accept: true }, // Auto-accept "unsaved changes" dialogs
      );

      if (!cancelled) {
        return nsFail(
          notARecordPage('nlapiCancel not available and Cancel button not found'),
          Date.now() - start,
          { dialogs },
        );
      }

      return nsOk<NsCancelData>(
        { cancelled: true, dialogs },
        Date.now() - start,
        { dialogs },
      );
    }, { label: 'ns cancel' }),
  );
}
