/**
 * ns navigate — Navigate to a NetSuite record page.
 *
 * Usage:
 *   ns navigate salesorder              → new record creation page
 *   ns navigate salesorder --id 12345   → existing record (view mode)
 *   ns navigate salesorder --id 12345 --edit → existing record (edit mode)
 *
 * Uses RECORD_URL_MAP.buildUrl() for URL construction, then verifies
 * the page loaded correctly via guardNsApi + detectSessionExpiry + detectFormMode.
 */

import type { BrowserManager } from '../../core/browser-manager';
import type { NsCommandResult } from '../errors';
import { RECORD_URL_MAP } from '../tier1';
import { guardNsApi, detectSessionExpiry, nsOk, nsFail, notARecordPage, validationError } from '../errors';
import { detectFormMode } from '../utils/introspect-field';
import { withMutex, nsMutex } from '../mutex';

interface NsNavigateData {
  url: string;
  recordType: string;
  mode: string;
  sessionValid: boolean;
}

/**
 * Parse ns navigate args: <recordType> [--id <num>] [--edit]
 */
function parseNavigateArgs(args: string[]): { recordType: string | null; id: string | undefined; edit: boolean } {
  let recordType: string | null = null;
  let id: string | undefined;
  let edit = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--id') {
      id = args[++i];
    } else if (arg === '--edit') {
      edit = true;
    } else if (!recordType) {
      recordType = arg;
    }
  }

  return { recordType, id, edit };
}

export async function nsNavigate(args: string[], bm: BrowserManager): Promise<string> {
  const start = Date.now();

  const { recordType, id, edit } = parseNavigateArgs(args);

  if (!recordType) {
    const result: NsCommandResult = nsFail(
      validationError('Missing record type. Usage: ns navigate <recordType> [--id <num>] [--edit]'),
      Date.now() - start,
    );
    return JSON.stringify(result);
  }

  return withMutex(nsMutex, async () => {
    try {
      const page = bm.getPage();
      const relativePath = RECORD_URL_MAP.buildUrl(recordType, id, edit);

      // Build full URL: use the current origin if on an NS page, otherwise just use the path
      // (for real NS usage, page.goto with a relative path would work against the current origin)
      const currentUrl = page.url();
      let fullUrl: string;
      try {
        const origin = new URL(currentUrl).origin;
        // If we're on a real NS page (not about:blank), use its origin
        if (origin && origin !== 'null' && !currentUrl.startsWith('about:')) {
          fullUrl = origin + relativePath;
        } else {
          fullUrl = relativePath;
        }
      } catch {
        fullUrl = relativePath;
      }

      await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

      // Verify we landed on an NS page
      const target = bm.getActiveFrameOrPage();

      const sessionError = await detectSessionExpiry(target);
      if (sessionError) {
        const result: NsCommandResult = nsFail(sessionError, Date.now() - start);
        return JSON.stringify(result);
      }

      const apiError = await guardNsApi(target);
      if (apiError) {
        const result: NsCommandResult = nsFail(apiError, Date.now() - start);
        return JSON.stringify(result);
      }

      const mode = await detectFormMode(target);

      const data: NsNavigateData = {
        url: page.url(),
        recordType,
        mode,
        sessionValid: true,
      };

      const result: NsCommandResult<NsNavigateData> = nsOk(data, Date.now() - start);
      return JSON.stringify(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const result: NsCommandResult = nsFail(
        notARecordPage(`Navigation failed: ${message}`),
        Date.now() - start,
      );
      return JSON.stringify(result);
    }
  }, { label: 'ns navigate' });
}
