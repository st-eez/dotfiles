/**
 * NetSuite command dispatcher.
 *
 * All NS commands return NsCommandOutput { display, ok, metadata? }.
 * The server uses .display as the HTTP response body and .metadata
 * for the activity stream.
 */

import type { BrowserManager } from '../core/browser-manager';
import type { NsCommandOutput } from './format';
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

export async function handleNsCommand(
  command: string,
  args: string[],
  browserManager: BrowserManager,
): Promise<NsCommandOutput> {
  const nsCommand = command.replace(/^ns\s+/, '');

  switch (nsCommand) {
    case 'navigate':
      return nsNavigate(args, browserManager);

    case 'inspect':
      return nsInspect(args, browserManager);

    case 'set':
      return nsSet(args, browserManager);

    case 'add-row':
      return nsAddRow(args, browserManager);

    case 'save':
      return nsSave(args, browserManager);

    case 'query':
      return nsQuery(args, browserManager);

    case 'status':
      return nsStatus(args, browserManager);

    case 'cancel':
      return nsCancel(args, browserManager);

    case 'diff':
      return nsDiff(args, browserManager);

    case 'verify':
      return nsVerify(args, browserManager);

    case 'login':
      return nsLogin(args, browserManager);

    default:
      return {
        display: `Unknown NS command: ${nsCommand}\nAvailable: navigate, inspect, set, add-row, save, query, status, cancel, diff, verify, login`,
        ok: false,
      };
  }
}
