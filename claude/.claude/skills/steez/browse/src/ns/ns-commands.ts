/**
 * NetSuite command dispatcher.
 *
 * Commands are migrating from JSON (NsCommandResult) to NsCommandOutput.
 * During transition, legacy string returns are wrapped via wrapLegacyResult().
 * Once a command returns NsCommandOutput directly, remove its wrapper call.
 */

import type { BrowserManager } from '../core/browser-manager';
import type { NsCommandOutput } from './format';
import { extractNsMetadata } from './ns-metadata';
import { nsNavigate } from './commands/ns-navigate';
import { nsQuery } from './commands/ns-query';
import { nsStatus } from './commands/ns-status';
import { nsCancel } from './commands/ns-cancel';
import { nsInspect } from './commands/ns-inspect';
import { nsSave } from './commands/ns-save';
import { nsSet } from './commands/ns-set';
import { nsAddRow } from './commands/ns-add-row';
import { nsDiff } from './commands/ns-diff';
import { nsVerify } from './commands/ns-verify';
import { nsLogin } from './commands/ns-login';

// ─── Legacy adapter ────────────────────────────────────────────
// Wraps a JSON string (NsCommandResult) into NsCommandOutput during
// the migration. Remove once all commands return NsCommandOutput directly.

function wrapLegacyResult(jsonStr: string): NsCommandOutput {
  try {
    const parsed = JSON.parse(jsonStr);
    return {
      display: jsonStr,
      ok: parsed.ok ?? false,
      metadata: extractNsMetadata(jsonStr),
    };
  } catch {
    return { display: jsonStr, ok: false };
  }
}

// ─── Dispatcher ─────────────────────────────────────────────────

export async function handleNsCommand(
  command: string,
  args: string[],
  browserManager: BrowserManager,
): Promise<NsCommandOutput> {
  const nsCommand = command.replace(/^ns\s+/, '');

  switch (nsCommand) {
    case 'navigate':
      return wrapLegacyResult(await nsNavigate(args, browserManager));

    case 'inspect':
      return wrapLegacyResult(await nsInspect(args, browserManager));

    case 'set':
      return wrapLegacyResult(await nsSet(args, browserManager));

    case 'add-row':
      return wrapLegacyResult(await nsAddRow(args, browserManager));

    case 'save':
      return wrapLegacyResult(await nsSave(args, browserManager));

    case 'query':
      return wrapLegacyResult(await nsQuery(args, browserManager));

    case 'status':
      return wrapLegacyResult(await nsStatus(args, browserManager));

    case 'cancel':
      return wrapLegacyResult(await nsCancel(args, browserManager));

    case 'diff':
      return wrapLegacyResult(await nsDiff(args, browserManager));

    case 'verify':
      return wrapLegacyResult(await nsVerify(args, browserManager));

    case 'login':
      return wrapLegacyResult(await nsLogin(args, browserManager));

    default:
      return {
        display: `Unknown NS command: ${nsCommand}\nAvailable: navigate, inspect, set, add-row, save, query, status, cancel, diff, verify, login`,
        ok: false,
      };
  }
}
