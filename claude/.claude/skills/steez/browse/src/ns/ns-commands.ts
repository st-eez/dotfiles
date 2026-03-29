/**
 * NetSuite command handlers — MVP stubs.
 *
 * All NS commands follow the pattern: (command, args, browserManager) → string (JSON).
 * Each stub returns { error: 'not implemented', command } so the agent gets structured feedback.
 *
 * Phase 2 will replace these stubs with real implementations that use page.evaluate()
 * to call NetSuite client-side APIs (nlapiGetField, nlapiSetFieldValue, etc.).
 */

import type { BrowserManager } from '../core/browser-manager';
import { nsNavigate } from './commands/ns-navigate';
import { nsQuery } from './commands/ns-query';
import { nsStatus } from './commands/ns-status';
import { nsCancel } from './commands/ns-cancel';

export async function handleNsCommand(
  command: string,
  args: string[],
  browserManager: BrowserManager,
): Promise<string> {
  const nsCommand = command.replace(/^ns\s+/, '');

  switch (nsCommand) {
    case 'navigate':
      return nsNavigate(args, browserManager);

    case 'inspect':
      return stub('ns inspect', args, 'Full form inspection: fields, sublists, @refs');

    case 'set':
      return stub('ns set', args, 'Set field value with auto-detect cascading');

    case 'add-row':
      return stub('ns add-row', args, 'Add sublist row with field values');

    case 'save':
      return stub('ns save', args, 'Save record with concurrency detection');

    case 'query':
      return nsQuery(args, browserManager);

    case 'status':
      return nsStatus(args, browserManager);

    case 'cancel':
      return nsCancel(args, browserManager);

    default:
      return JSON.stringify({
        error: `Unknown NS command: ${nsCommand}`,
        hint: 'Available: navigate, inspect, set, add-row, save, query, status, cancel',
      });
  }
}

function stub(command: string, args: string[], description: string): string {
  return JSON.stringify({
    error: 'not implemented',
    command,
    args,
    description,
    phase: 'Phase 2 will implement this command',
  });
}
