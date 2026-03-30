/**
 * Unit tests for NS typed error taxonomy + recovery model.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { BrowserManager } from '../../core/browser-manager';
import {
  validationError,
  concurrencyError,
  sessionExpired,
  saveTimeout,
  notARecordPage,
  guardNsApi,
  detectSessionExpiry,
  detectConcurrencyFromMessage,
  detectValidationFromMessage,
  classifyMessage,
  type NsError,
} from '../errors';
import * as path from 'path';
import * as fs from 'fs';

// ─── Test server ────────────────────────────────────────────

const FIXTURES_DIR = path.resolve(import.meta.dir, 'fixtures');

function startTestServer(port: number = 0) {
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

let testServer: ReturnType<typeof startTestServer>;
let bm: BrowserManager;
let baseUrl: string;

beforeAll(async () => {
  testServer = startTestServer(0);
  baseUrl = testServer.url;
  bm = new BrowserManager();
  await bm.launch();
});

afterAll(() => {
  try { testServer.server.stop(); } catch {}
  setTimeout(() => process.exit(0), 500);
});

// ─── Error constructors ─────────────────────────────────────

describe('Error constructors', () => {
  test('validationError has correct shape', () => {
    const err = validationError('Field is required');
    expect(err.type).toBe('ValidationError');
    expect(err.message).toBe('Field is required');
    expect(err.recoverable).toBe(true);
    expect(typeof err.suggestedAction).toBe('string');
  });

  test('concurrencyError is recoverable', () => {
    const err = concurrencyError('Record has been changed');
    expect(err.type).toBe('ConcurrencyError');
    expect(err.recoverable).toBe(true);
  });

  test('sessionExpired is not recoverable', () => {
    const err = sessionExpired('Session timed out');
    expect(err.type).toBe('SessionExpired');
    expect(err.recoverable).toBe(false);
  });

  test('saveTimeout is recoverable', () => {
    const err = saveTimeout('Save operation timed out');
    expect(err.type).toBe('SaveTimeout');
    expect(err.recoverable).toBe(true);
  });

  test('notARecordPage is not recoverable', () => {
    const err = notARecordPage('Not on a record page');
    expect(err.type).toBe('NotARecordPage');
    expect(err.recoverable).toBe(false);
  });

  test('all errors have non-empty suggestedAction', () => {
    const errors = [
      validationError('test'),
      concurrencyError('test'),
      sessionExpired('test'),
      saveTimeout('test'),
      notARecordPage('test'),
    ];
    for (const err of errors) {
      expect(err.suggestedAction.length).toBeGreaterThan(0);
    }
  });
});

// ─── guardNsApi ─────────────────────────────────────────────

describe('guardNsApi', () => {
  test('returns null on a page with nlapi functions', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');
    const target = bm.getActiveFrameOrPage();
    const err = await guardNsApi(target);
    expect(err).toBeNull();
  });

  test('returns NotARecordPage on a plain page', async () => {
    const page = bm.getPage();
    // Navigate to a page without nlapi stubs
    await page.goto('about:blank');
    const target = bm.getActiveFrameOrPage();
    const err = await guardNsApi(target);
    expect(err).not.toBeNull();
    expect(err!.type).toBe('NotARecordPage');

    // Navigate back
    await page.goto(baseUrl + '/ns-form.html');
  });
});

// ─── detectSessionExpiry ────────────────────────────────────

describe('detectSessionExpiry', () => {
  test('returns null on a normal NS page', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form.html');
    const target = bm.getActiveFrameOrPage();
    const err = await detectSessionExpiry(target);
    expect(err).toBeNull();
  });

  test('returns null on a page with i18n script tags containing session-expired text', async () => {
    const page = bm.getPage();
    await page.goto(baseUrl + '/ns-form-i18n.html');
    const target = bm.getActiveFrameOrPage();
    const err = await detectSessionExpiry(target);
    expect(err).toBeNull();
  });
});

// ─── Message classification ─────────────────────────────────

describe('detectConcurrencyFromMessage', () => {
  test('detects "record has been changed"', () => {
    const err = detectConcurrencyFromMessage('This record has been changed since you started editing');
    expect(err).not.toBeNull();
    expect(err!.type).toBe('ConcurrencyError');
  });

  test('detects "another user has updated"', () => {
    const err = detectConcurrencyFromMessage('Another user has updated this record');
    expect(err).not.toBeNull();
    expect(err!.type).toBe('ConcurrencyError');
  });

  test('returns null for unrelated message', () => {
    expect(detectConcurrencyFromMessage('Save successful')).toBeNull();
  });
});

describe('detectValidationFromMessage', () => {
  test('detects "please enter a value for"', () => {
    const err = detectValidationFromMessage('Please enter a value for Company Name');
    expect(err).not.toBeNull();
    expect(err!.type).toBe('ValidationError');
  });

  test('detects "field is required"', () => {
    const err = detectValidationFromMessage('This field is required');
    expect(err).not.toBeNull();
    expect(err!.type).toBe('ValidationError');
  });

  test('returns null for unrelated message', () => {
    expect(detectValidationFromMessage('Record saved')).toBeNull();
  });
});

describe('classifyMessage', () => {
  test('classifies concurrency over validation', () => {
    const err = classifyMessage('This record has been changed by another user');
    expect(err!.type).toBe('ConcurrencyError');
  });

  test('classifies validation errors', () => {
    const err = classifyMessage('Please enter a value for Total');
    expect(err!.type).toBe('ValidationError');
  });

  test('returns null for informational messages', () => {
    expect(classifyMessage('Record saved successfully')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(classifyMessage('')).toBeNull();
  });
});
