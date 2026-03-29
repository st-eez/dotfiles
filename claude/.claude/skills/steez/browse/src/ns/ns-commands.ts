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

export async function handleNsCommand(
  command: string,
  args: string[],
  browserManager: BrowserManager,
): Promise<string> {
  const nsCommand = command.replace(/^ns\s+/, '');

  switch (nsCommand) {
    case 'navigate':
      return stub('ns navigate', args, 'Navigate to a NetSuite record (new or existing)');

    case 'inspect':
      return stub('ns inspect', args, 'Full form inspection: fields, sublists, @refs');

    case 'set':
      return stub('ns set', args, 'Set field value with auto-detect cascading');

    case 'add-row':
      return stub('ns add-row', args, 'Add sublist row with field values');

    case 'save':
      return stub('ns save', args, 'Save record with concurrency detection');

    case 'query':
      return stub('ns query', args, 'Execute SuiteQL query (SELECT only)');

    case 'status':
      return stub('ns status', args, 'Current page state: record type, mode, session validity');

    case 'cancel':
      return stub('ns cancel', args, 'Clear current line, return to form view');

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
