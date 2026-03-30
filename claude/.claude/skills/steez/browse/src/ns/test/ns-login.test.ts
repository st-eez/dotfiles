/**
 * Tests for ns login command.
 *
 * Uses a local test server serving login + form fixtures.
 * Auth config is created as a temp file with 600 perms — never touches ~/.steez.
 * The _loginUrl override parameter points nsLogin at the local test server
 * instead of the real NetSuite login page.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { BrowserManager } from '../../core/browser-manager';
import { nsLogin } from '../commands/ns-login';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// ─── Test server ────────────────────────────────────────────

const FIXTURES_DIR = path.resolve(import.meta.dir, 'fixtures');

function startLoginTestServer(port: number = 0) {
  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',
    fetch(req) {
      const url = new URL(req.url);
      const pathname = url.pathname;

      let filePath: string;
      if (pathname === '/pages/customerlogin.jsp' || pathname === '/') {
        filePath = 'ns-login.html';
      } else if (pathname === '/pages/customerlogin-security.jsp') {
        filePath = 'ns-login-security.html';
      } else if (pathname === '/app/login/secure/securityquestions.nl') {
        filePath = 'ns-security-question.html';
      } else if (pathname === '/ns-form.html') {
        filePath = 'ns-form.html';
      } else {
        filePath = pathname.replace(/^\//, '');
      }

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

let testServer: ReturnType<typeof startLoginTestServer>;
let bm: BrowserManager;
let baseUrl: string;
let loginUrl: string;
let securityLoginUrl: string;
let tmpDir: string;

beforeAll(async () => {
  testServer = startLoginTestServer(0);
  baseUrl = testServer.url;
  loginUrl = `${baseUrl}/pages/customerlogin.jsp`;
  securityLoginUrl = `${baseUrl}/pages/customerlogin-security.jsp`;
  bm = new BrowserManager();
  await bm.launch();

  // Create temp dir for auth config files
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-login-test-'));
});

afterAll(() => {
  try { testServer.server.stop(); } catch {}
  // Clean up temp dir
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  setTimeout(() => process.exit(0), 500);
});

// ─── Helper: create a temp auth config ─────────────────────

function createAuthConfig(
  accounts: Record<string, { email: string; password: string; securityQuestions?: Record<string, string> }>,
): string {
  const authPath = path.join(tmpDir, `auth-${Date.now()}.json`);
  fs.writeFileSync(authPath, JSON.stringify({ accounts }), 'utf-8');
  fs.chmodSync(authPath, 0o600);
  return authPath;
}

// ─── Missing auth config ───────────────────────────────────

describe('ns login — missing auth config', () => {
  test('returns helpful error when auth config does not exist', async () => {
    const fakePath = path.join(tmpDir, 'nonexistent-auth.json');
    const result = JSON.parse(await nsLogin([], bm, fakePath, loginUrl));

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('Auth config not found');
    expect(result.error.message).toContain('chmod 600');
    expect(result.error.message).toContain('"accounts"');
  });
});

// ─── Login with mock credentials ───────────────────────────

describe('ns login — successful login', () => {
  test('fills credentials and submits, ending on form page', async () => {
    const authPath = createAuthConfig({
      'TEST_ACCT': { email: 'test@example.com', password: 'secret123' },
    });

    const result = JSON.parse(
      await nsLogin([], bm, authPath, loginUrl),
    );

    expect(result.ok).toBe(true);
    expect(result.data.loggedIn).toBe(true);
    expect(result.data.account).toBe('TEST_ACCT');
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });
});

// ─── Account selection ─────────────────────────────────────

describe('ns login — account selection', () => {
  test('--account flag selects the correct account', async () => {
    const authPath = createAuthConfig({
      'ACCT_1': { email: 'one@example.com', password: 'pass1' },
      'ACCT_2': { email: 'two@example.com', password: 'pass2' },
    });

    const result = JSON.parse(
      await nsLogin(['--account', 'ACCT_2'], bm, authPath, loginUrl),
    );

    expect(result.ok).toBe(true);
    expect(result.data.account).toBe('ACCT_2');
    expect(result.data.loggedIn).toBe(true);
  });

  test('returns error for non-existent account', async () => {
    const authPath = createAuthConfig({
      'ACCT_1': { email: 'one@example.com', password: 'pass1' },
      'ACCT_2': { email: 'two@example.com', password: 'pass2' },
    });

    const result = JSON.parse(
      await nsLogin(['--account', 'DOES_NOT_EXIST'], bm, authPath, loginUrl),
    );

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('DOES_NOT_EXIST');
    expect(result.error.message).toContain('ACCT_1');
    expect(result.error.message).toContain('ACCT_2');
  });

  test('uses first account when no --account flag', async () => {
    const authPath = createAuthConfig({
      'DEFAULT_ACCT': { email: 'default@example.com', password: 'defaultpass' },
      'OTHER_ACCT': { email: 'other@example.com', password: 'otherpass' },
    });

    const result = JSON.parse(
      await nsLogin([], bm, authPath, loginUrl),
    );

    expect(result.ok).toBe(true);
    expect(result.data.account).toBe('DEFAULT_ACCT');
  });
});

// ─── Auth config validation ────────────────────────────────

describe('ns login — auth config validation', () => {
  test('returns error for empty accounts object', async () => {
    const authPath = path.join(tmpDir, `auth-empty-${Date.now()}.json`);
    fs.writeFileSync(authPath, JSON.stringify({ accounts: {} }), 'utf-8');
    fs.chmodSync(authPath, 0o600);

    const result = JSON.parse(await nsLogin([], bm, authPath, loginUrl));

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('no accounts');
  });

  test('returns error for malformed JSON', async () => {
    const authPath = path.join(tmpDir, `auth-bad-${Date.now()}.json`);
    fs.writeFileSync(authPath, '{ not valid json', 'utf-8');
    fs.chmodSync(authPath, 0o600);

    const result = JSON.parse(await nsLogin([], bm, authPath, loginUrl));

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('Failed to read auth config');
  });

  test('returns error for insecure file permissions', async () => {
    // Skip on Windows (no Unix perms)
    if (process.platform === 'win32') return;

    const authPath = path.join(tmpDir, `auth-perms-${Date.now()}.json`);
    fs.writeFileSync(
      authPath,
      JSON.stringify({ accounts: { X: { email: 'a', password: 'b' } } }),
      'utf-8',
    );
    fs.chmodSync(authPath, 0o644); // World-readable — should fail

    const result = JSON.parse(await nsLogin([], bm, authPath, loginUrl));

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('insecure permissions');
    expect(result.error.message).toContain('chmod 600');
  });
});

// ─── Security question flow ───────────────────────────────

describe('ns login — security question', () => {
  test('answers security question and completes login', async () => {
    const authPath = createAuthConfig({
      'SEC_ACCT': {
        email: 'sec@example.com',
        password: 'secpass',
        securityQuestions: { 'favorite color': 'blue' },
      },
    });

    const result = JSON.parse(
      await nsLogin([], bm, authPath, securityLoginUrl),
    );

    expect(result.ok).toBe(true);
    expect(result.data.loggedIn).toBe(true);
    expect(result.data.account).toBe('SEC_ACCT');
  });

  test('returns validation error when securityQuestions not configured', async () => {
    const authPath = createAuthConfig({
      'NO_SEC_ACCT': {
        email: 'nosec@example.com',
        password: 'nosecpass',
      },
    });

    const result = JSON.parse(
      await nsLogin([], bm, authPath, securityLoginUrl),
    );

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('securityQuestions');
  });

  test('returns validation error when no question keyword matches', async () => {
    const authPath = createAuthConfig({
      'WRONG_SEC_ACCT': {
        email: 'wrong@example.com',
        password: 'wrongpass',
        securityQuestions: { 'pet name': 'Fluffy' },
      },
    });

    const result = JSON.parse(
      await nsLogin([], bm, authPath, securityLoginUrl),
    );

    expect(result.ok).toBe(false);
    expect(result.error.type).toBe('ValidationError');
    expect(result.error.message).toContain('not matched');
  });
});

// ─── Result shape ──────────────────────────────────────────

describe('ns login — result shape', () => {
  test('result includes loggedIn status, account, and timing', async () => {
    const authPath = createAuthConfig({
      'SHAPE_TEST': { email: 'shape@example.com', password: 'shapepass' },
    });

    const result = JSON.parse(
      await nsLogin([], bm, authPath, loginUrl),
    );

    expect(typeof result.ok).toBe('boolean');
    expect(typeof result.elapsedMs).toBe('number');
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.data.loggedIn).toBe('boolean');
    expect(typeof result.data.account).toBe('string');
  });
});
