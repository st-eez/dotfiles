/**
 * Playwright tracing commands — wraps context.tracing.start/stop.
 *
 * tracing-start: Begin recording a Playwright trace (screenshots + snapshots + network).
 * tracing-stop:  Stop recording and save the trace file.
 *
 * Trace files can be viewed with: npx playwright show-trace <path>
 */

import type { BrowserManager } from '../core/browser-manager';
import * as path from 'path';

const TRACE_DIR = path.join(process.env.HOME || '/tmp', '.steez', 'browse', 'traces');

export async function handleTracingCommand(
  command: string,
  args: string[],
  browserManager: BrowserManager,
): Promise<string> {
  const context = browserManager.getContext();
  if (!context) {
    return JSON.stringify({ error: 'No browser context available. Run a goto command first.' });
  }

  if (command === 'tracing-start') {
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: false,
    });
    return JSON.stringify({ tracing: true, message: 'Trace recording started' });
  }

  if (command === 'tracing-stop') {
    const fs = require('fs');
    fs.mkdirSync(TRACE_DIR, { recursive: true });
    const tracePath = args[0] || path.join(TRACE_DIR, `trace-${Date.now()}.zip`);
    await context.tracing.stop({ path: tracePath });
    return JSON.stringify({
      tracing: false,
      path: tracePath,
      message: `Trace saved. View with: npx playwright show-trace ${tracePath}`,
    });
  }

  return JSON.stringify({ error: `Unknown tracing command: ${command}` });
}
