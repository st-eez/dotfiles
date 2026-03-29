/**
 * Playwright routing commands — wraps page.route() for network mocking/interception.
 *
 * route:      Intercept requests matching a URL pattern and respond with custom data.
 * unroute:    Remove a previously set route.
 * route-list: Show all active routes.
 */

import type { BrowserManager } from '../core/browser-manager';

// Track active routes so we can list and remove them
const activeRoutes = new Map<string, { pattern: string; action: string }>();

export async function handleRoutingCommand(
  command: string,
  args: string[],
  browserManager: BrowserManager,
): Promise<string> {
  const page = browserManager.getPage();
  if (!page) {
    return JSON.stringify({ error: 'No page available. Run a goto command first.' });
  }

  if (command === 'route') {
    const pattern = args[0];
    const action = args[1] || 'abort'; // abort | fulfill:<status> | continue

    if (!pattern) {
      return JSON.stringify({
        error: 'Missing URL pattern',
        usage: 'route <url-pattern> [abort|fulfill:<status>|continue]',
      });
    }

    if (action === 'abort') {
      await page.route(pattern, (route) => route.abort());
    } else if (action.startsWith('fulfill:')) {
      const status = parseInt(action.split(':')[1], 10) || 200;
      await page.route(pattern, (route) =>
        route.fulfill({ status, body: '', contentType: 'text/plain' }),
      );
    } else if (action === 'continue') {
      await page.route(pattern, (route) => route.continue());
    } else {
      return JSON.stringify({
        error: `Unknown action: ${action}`,
        hint: 'Use: abort, fulfill:<status>, or continue',
      });
    }

    activeRoutes.set(pattern, { pattern, action });
    return JSON.stringify({
      routed: true,
      pattern,
      action,
      activeCount: activeRoutes.size,
    });
  }

  if (command === 'unroute') {
    const pattern = args[0];
    if (!pattern) {
      return JSON.stringify({ error: 'Missing URL pattern', usage: 'unroute <url-pattern>' });
    }

    await page.unroute(pattern);
    activeRoutes.delete(pattern);
    return JSON.stringify({
      unrouted: true,
      pattern,
      activeCount: activeRoutes.size,
    });
  }

  if (command === 'route-list') {
    return JSON.stringify({
      routes: Array.from(activeRoutes.values()),
      count: activeRoutes.size,
    });
  }

  return JSON.stringify({ error: `Unknown routing command: ${command}` });
}
