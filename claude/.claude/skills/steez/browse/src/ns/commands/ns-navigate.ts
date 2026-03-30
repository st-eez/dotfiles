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
import type { NsMetadata } from '../../core/activity';
import type { NsCommandOutput } from '../format';
import { formatNsError } from '../format';
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

export async function nsNavigate(args: string[], bm: BrowserManager): Promise<NsCommandOutput> {
  const start = Date.now();

  const { recordType, id, edit } = parseNavigateArgs(args);

  if (!recordType) {
    const err = validationError('Missing record type. Usage: ns navigate <recordType> [--id <num>] [--edit]');
    return { display: formatNsError('ns navigate', err), ok: false };
  }

  const result = await withMutex(nsMutex, async (): Promise<NsCommandResult<NsNavigateData>> => {
    try {
      const page = bm.getPage();
      const relativePath = RECORD_URL_MAP.buildUrl(recordType, id, edit);

      // Build full URL: use the current origin if on an NS page, otherwise just use the path
      const currentUrl = page.url();
      let fullUrl: string;
      try {
        const origin = new URL(currentUrl).origin;
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
        return nsFail(sessionError, Date.now() - start);
      }

      const apiError = await guardNsApi(target);
      if (apiError) {
        return nsFail(apiError, Date.now() - start);
      }

      const mode = await detectFormMode(target);

      return nsOk<NsNavigateData>(
        { url: page.url(), recordType, mode, sessionValid: true },
        Date.now() - start,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return nsFail(
        notARecordPage(`Navigation failed: ${message}`),
        Date.now() - start,
      );
    }
  }, { label: 'ns navigate' });

  if (!result.ok) {
    return { display: formatNsError('ns navigate', result.error!), ok: false };
  }

  const d = result.data!;
  const display = `NAVIGATE OK | ${d.recordType} (${d.mode}) | ${d.url}`;

  const metadata: NsMetadata = { recordType: d.recordType };
  const idMatch = d.url.match(/[?&]id=(\d+)/);
  if (idMatch) metadata.recordId = idMatch[1];
  if (/_SB\d*/i.test(d.url) || /sandbox/i.test(d.url)) {
    metadata.environment = 'sandbox';
  } else if (d.url.startsWith('http')) {
    metadata.environment = 'production';
  }

  return { display, ok: true, metadata };
}
