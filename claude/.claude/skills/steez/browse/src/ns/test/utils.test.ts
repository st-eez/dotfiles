/**
 * Unit tests for shared NS utilities.
 *
 * Tests introspect-field, with-retry, and with-dialog-handler against
 * a mock NetSuite form served from test fixtures.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { BrowserManager } from '../../core/browser-manager';
import { introspectField, introspectAllFields, detectFormMode, type NsFieldMetadata } from '../utils/introspect-field';
import { withRetry, waitForSettle } from '../utils/with-retry';
import { withDialogHandler, detectDomModal } from '../utils/with-dialog-handler';
import * as path from 'path';
import * as fs from 'fs';

// ─── Test server (same pattern as core tests) ──────────────

const FIXTURES_DIR = path.resolve(import.meta.dir, 'fixtures');

function startNsTestServer(port: number = 0) {
  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',
    fetch(req) {
      const url = new URL(req.url);
      let filePath = url.pathname === '/' ? '/ns-form.html' : url.pathname;
      filePath = filePath.replace(/^\//, '');
      const fullPath = path.join(FIXTURES_DIR, filePath);

      if (!fs.existsSync(fullPath)) {
        return new Response('Not Found', { status: 404 });
      }

      const content = fs.readFileSync(fullPath, 'utf-8');
      return new Response(content, {
        headers: { 'Content-Type': 'text/html' },
      });
    },
  });
  return { server, url: `http://127.0.0.1:${server.port}` };
}

let testServer: ReturnType<typeof startNsTestServer>;
let bm: BrowserManager;
let baseUrl: string;

beforeAll(async () => {
  testServer = startNsTestServer(0);
  baseUrl = testServer.url;
  bm = new BrowserManager();
  await bm.launch();
  // Navigate to mock NS form
  await bm.getPage().goto(baseUrl + '/ns-form.html');
});

afterAll(() => {
  try { testServer.server.stop(); } catch {}
  setTimeout(() => process.exit(0), 500);
});

// ─── introspectField ────────────────────────────────────────

describe('introspectField', () => {
  test('returns metadata for a text field', async () => {
    const target = bm.getActiveFrameOrPage();
    const field = await introspectField(target, 'companyname');

    expect(field).not.toBeNull();
    expect(field!.id).toBe('companyname');
    expect(field!.type).toBe('text');
    expect(field!.label).toBe('Company Name');
    expect(field!.mandatory).toBe(true);
    expect(field!.disabled).toBe(false);
    expect(field!.value).toBe('Acme Corp');
    expect(field!.isEntityRef).toBe(false);
    expect(field!.options).toBeUndefined();
  });

  test('returns null for nonexistent field', async () => {
    const target = bm.getActiveFrameOrPage();
    const field = await introspectField(target, 'bogus_field_xyz');
    expect(field).toBeNull();
  });

  test('detects entity-ref via _display companion', async () => {
    const target = bm.getActiveFrameOrPage();
    const field = await introspectField(target, 'salesrep');

    expect(field).not.toBeNull();
    expect(field!.isEntityRef).toBe(true);
    expect(field!.value).toBe('42');
    expect(field!.displayValue).toBe('Jane Smith');
  });

  test('extracts dropdown options for select fields', async () => {
    const target = bm.getActiveFrameOrPage();
    const field = await introspectField(target, 'entitystatus');

    expect(field).not.toBeNull();
    expect(field!.type).toBe('select');
    expect(field!.options).toBeDefined();
    expect(field!.options!.length).toBe(3);
    expect(field!.options!.find(o => o.text === 'Customer - Lead')).toBeDefined();
  });

  test('detects disabled fields', async () => {
    const target = bm.getActiveFrameOrPage();
    const field = await introspectField(target, 'formulatext');

    expect(field).not.toBeNull();
    expect(field!.disabled).toBe(true);
  });

  test('handles currency fields', async () => {
    const target = bm.getActiveFrameOrPage();
    const field = await introspectField(target, 'total');

    expect(field).not.toBeNull();
    expect(field!.type).toBe('currency');
    expect(field!.mandatory).toBe(true);
    expect(field!.value).toBe('1500.00');
    expect(field!.displayValue).toBe('$1,500.00');
  });
});

// ─── introspectAllFields ────────────────────────────────────

describe('introspectAllFields', () => {
  test('discovers all fields on the form', async () => {
    const target = bm.getActiveFrameOrPage();
    const fields = await introspectAllFields(target);

    expect(fields.length).toBe(5);
    const ids = fields.map(f => f.id).sort();
    expect(ids).toEqual(['companyname', 'entitystatus', 'formulatext', 'salesrep', 'total']);
  });

  test('each field has required metadata shape', async () => {
    const target = bm.getActiveFrameOrPage();
    const fields = await introspectAllFields(target);

    for (const field of fields) {
      expect(typeof field.id).toBe('string');
      expect(typeof field.label).toBe('string');
      expect(typeof field.type).toBe('string');
      expect(typeof field.mandatory).toBe('boolean');
      expect(typeof field.disabled).toBe('boolean');
      expect(typeof field.isEntityRef).toBe('boolean');
      // value can be null or string
      expect(field.value === null || typeof field.value === 'string').toBe(true);
    }
  });
});

// ─── detectFormMode ─────────────────────────────────────────

describe('detectFormMode', () => {
  test('detects create mode (no id param)', async () => {
    const target = bm.getActiveFrameOrPage();
    const mode = await detectFormMode(target);
    // Local test server URL has no ?id= or ?e= params
    expect(mode).toBe('create');
  });

  test('detects edit mode from URL', async () => {
    const page = bm.getPage();
    // Navigate to URL with edit params
    await page.goto(baseUrl + '/ns-form.html?id=123&e=T');
    const target = bm.getActiveFrameOrPage();
    const mode = await detectFormMode(target);
    expect(mode).toBe('edit');
    // Navigate back to clean state
    await page.goto(baseUrl + '/ns-form.html');
  });

  test('detects view mode from URL', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html?id=123');
    const target = bm.getActiveFrameOrPage();
    const mode = await detectFormMode(target);
    expect(mode).toBe('view');
    await page.goto(baseUrl + '/ns-form.html');
  });
});

// ─── withRetry ──────────────────────────────────────────────

describe('withRetry', () => {
  test('returns result on first success', async () => {
    const result = await withRetry(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });

  test('retries on failure then succeeds', async () => {
    let attempts = 0;
    const result = await withRetry(() => {
      attempts++;
      if (attempts < 3) throw new Error('not ready');
      return Promise.resolve('eventually ok');
    }, { maxAttempts: 5, baseDelayMs: 50 });

    expect(result).toBe('eventually ok');
    expect(attempts).toBe(3);
  });

  test('throws after max attempts exhausted', async () => {
    let attempts = 0;
    await expect(
      withRetry(() => {
        attempts++;
        throw new Error('always fails');
      }, { maxAttempts: 3, baseDelayMs: 10 }),
    ).rejects.toThrow('all 3 attempts failed');
    expect(attempts).toBe(3);
  });

  test('respects timeout', async () => {
    const start = Date.now();
    await expect(
      withRetry(
        () => { throw new Error('fail'); },
        { maxAttempts: 100, baseDelayMs: 50, timeoutMs: 200 },
      ),
    ).rejects.toThrow(/timeout/);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000); // Should not take more than 1s
  });

  test('includes label in error message', async () => {
    await expect(
      withRetry(
        () => { throw new Error('boom'); },
        { maxAttempts: 1, label: 'ns-save' },
      ),
    ).rejects.toThrow('ns-save');
  });
});

// ─── waitForSettle ──────────────────────────────────────────

describe('waitForSettle', () => {
  test('settles quickly on static page', async () => {
    const target = bm.getActiveFrameOrPage();
    const result = await waitForSettle(target, {
      intervalMs: 50,
      stableMs: 150,
      timeoutMs: 3000,
    });

    expect(result.settled).toBe(true);
    expect(result.elapsedMs).toBeLessThan(2000);
  });

  test('detects DOM mutations and waits for them to stop', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    // Schedule DOM mutations every 80ms for ~400ms, then stop
    await page.evaluate(() => {
      let count = 0;
      const interval = setInterval(() => {
        (window as any).__mutateDOM('mutation ' + count++);
        if (count >= 5) clearInterval(interval);
      }, 80);
    });

    const target = bm.getActiveFrameOrPage();
    const result = await waitForSettle(target, {
      intervalMs: 50,
      stableMs: 300,
      timeoutMs: 5000,
      scope: '#mutation-target',
    });

    expect(result.settled).toBe(true);
    // Should take at least 300ms (stable period) — mutations may overlap with polling
    expect(result.elapsedMs).toBeGreaterThan(300);
  });

  test('returns settled=false on timeout', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    // Continuously mutate DOM (never settles) — mutate every 10ms so no stable window exists
    await page.evaluate(() => {
      let c = 0;
      (window as any).__mutationInterval = setInterval(() => {
        (window as any).__mutateDOM('endless ' + (c++));
      }, 10);
    });

    const target = bm.getActiveFrameOrPage();
    const result = await waitForSettle(target, {
      intervalMs: 30,
      stableMs: 400,
      timeoutMs: 800,
      scope: '#mutation-target',
    });

    expect(result.settled).toBe(false);

    // Clean up the interval
    await page.evaluate(() => clearInterval((window as any).__mutationInterval));
  });
});

// ─── withDialogHandler ──────────────────────────────────────

describe('withDialogHandler', () => {
  test('captures accepted dialog during operation', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const { result, dialogs } = await withDialogHandler(
      bm,
      async () => {
        await page.evaluate(() => alert('Save successful'));
        return 'done';
      },
      { accept: true },
    );

    expect(result).toBe('done');
    expect(dialogs.length).toBe(1);
    expect(dialogs[0].type).toBe('alert');
    expect(dialogs[0].message).toBe('Save successful');
    expect(dialogs[0].action).toBe('accepted');
  });

  test('captures dismissed dialog', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const { dialogs } = await withDialogHandler(
      bm,
      async () => {
        await page.evaluate(() => confirm('Discard changes?'));
        return 'cancelled';
      },
      { accept: false },
    );

    expect(dialogs.length).toBe(1);
    expect(dialogs[0].action).toBe('dismissed');
  });

  test('restores previous dialog state after operation', async () => {
    // Set a known state
    bm.setDialogAutoAccept(false);
    bm.setDialogPromptText('prev text');

    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    await withDialogHandler(
      bm,
      async () => {
        // During operation, dialog state should be overridden
        expect(bm.getDialogAutoAccept()).toBe(true);
        expect(bm.getDialogPromptText()).toBeNull();
        return 'done';
      },
      { accept: true, promptText: undefined },
    );

    // After operation, previous state should be restored
    expect(bm.getDialogAutoAccept()).toBe(false);
    expect(bm.getDialogPromptText()).toBe('prev text');

    // Restore defaults for other tests
    bm.setDialogAutoAccept(true);
    bm.setDialogPromptText(null);
  });

  test('restores state even on error', async () => {
    bm.setDialogAutoAccept(false);
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    try {
      await withDialogHandler(
        bm,
        async () => { throw new Error('operation failed'); },
        { accept: true },
      );
    } catch {
      // Expected
    }

    // Should still restore
    expect(bm.getDialogAutoAccept()).toBe(false);
    bm.setDialogAutoAccept(true);
  });

  test('returns empty dialogs array when no dialogs fire', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const { result, dialogs } = await withDialogHandler(
      bm,
      async () => 'no dialogs',
    );

    expect(result).toBe('no dialogs');
    expect(dialogs).toEqual([]);
  });
});

// ─── detectDomModal ─────────────────────────────────────────

describe('detectDomModal', () => {
  test('returns null when no modal is visible', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');

    const target = bm.getActiveFrameOrPage();
    const modal = await detectDomModal(target);
    expect(modal).toBeNull();
  });

  test('detects visible #_err_alert', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');
    await page.evaluate(() => (window as any).__showError('#_err_alert'));

    const target = bm.getActiveFrameOrPage();
    const modal = await detectDomModal(target);

    expect(modal).not.toBeNull();
    expect(modal!.type).toBe('error');
    expect(modal!.message).toContain('Validation error');
    expect(modal!.selector).toBe('#_err_alert');

    // Clean up
    await page.evaluate(() => (window as any).__hideError('#_err_alert'));
  });

  test('detects visible .uir-message-error', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');
    await page.evaluate(() => (window as any).__showError('.uir-message-error'));

    const target = bm.getActiveFrameOrPage();
    const modal = await detectDomModal(target);

    expect(modal).not.toBeNull();
    expect(modal!.type).toBe('error');
    expect(modal!.message).toContain('Server error');

    await page.evaluate(() => (window as any).__hideError('.uir-message-error'));
  });

  test('detects visible .uir-message-warning', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');
    await page.evaluate(() => (window as any).__showError('.uir-message-warning'));

    const target = bm.getActiveFrameOrPage();
    const modal = await detectDomModal(target);

    expect(modal).not.toBeNull();
    expect(modal!.type).toBe('warning');
    expect(modal!.message).toContain('duplicate record');

    await page.evaluate(() => (window as any).__hideError('.uir-message-warning'));
  });
});
