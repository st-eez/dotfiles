/**
 * ns login — Automated NetSuite login using stored credentials with account locking.
 *
 * Usage:
 *   ns login                              → login using first available (unlocked) account
 *   ns login --account 5582598-sb2:account2 → login to specific slot
 *   ns login --release                    → release all locks held by this process
 *
 * Auth config is read from ~/.steez/browse/auth.json (must be 600 perms).
 * Format:
 *   {
 *     "accounts": {
 *       "<slot>": {
 *         "email": "...",
 *         "password": "...",
 *         "accountId": "5582598-sb2",      // optional: actual NS account ID (defaults to slot key)
 *         "securityQuestions": { "keyword": "answer" }
 *       }
 *     }
 *   }
 *
 * Slots allow multiple users on the same sandbox (e.g. "5582598-sb2:account2", "5582598-sb2:account3").
 * The accountId field is the real NS account; the slot key is used for locking.
 *
 * Locking:
 *   - On login, a lock file is written to ~/.steez/browse/locks/<slot>.lock
 *   - Parallel agents auto-select the first unlocked slot
 *   - Locks are released on shutdown, or when PID dies, or after 2h TTL
 *
 * Handles:
 *   - Credential fill + submit
 *   - Security question detection + answer (case-insensitive keyword match)
 *   - 2FA detection (returns requires2FA, does not solve)
 *   - Success detection via URL redirect or NS client API presence
 */

import * as fs from 'fs';
import * as path from 'path';
import type { BrowserManager } from '../../core/browser-manager';
import type { NsMetadata } from '../../core/activity';
import type { NsCommandOutput } from '../format';
import { formatNsError } from '../format';
import type { NsResult } from '../errors';
import { validationError } from '../errors';
import { withMutex, nsMutex } from '../mutex';

// ─── Account Locking ──────────────────────────────────────

const LOCK_DIR = path.join(
  process.env.HOME || '/tmp',
  '.steez',
  'browse',
  'locks',
);

const LOCK_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

interface LockData {
  pid: number;
  ts: string;
}

function ensureLockDir(): void {
  if (!fs.existsSync(LOCK_DIR)) {
    fs.mkdirSync(LOCK_DIR, { recursive: true });
  }
}

function lockPath(accountId: string): string {
  return path.join(LOCK_DIR, `${accountId}.lock`);
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isLockValid(accountId: string): boolean {
  const lp = lockPath(accountId);
  if (!fs.existsSync(lp)) return false;

  try {
    const raw = fs.readFileSync(lp, 'utf-8');
    const lock: LockData = JSON.parse(raw);

    // Stale if PID is dead
    if (!isPidAlive(lock.pid)) {
      fs.unlinkSync(lp);
      return false;
    }

    // Stale if older than TTL
    const age = Date.now() - new Date(lock.ts).getTime();
    if (age > LOCK_TTL_MS) {
      fs.unlinkSync(lp);
      return false;
    }

    // Lock is held by another live process
    return lock.pid !== process.pid;
  } catch {
    // Corrupt lock file — remove it
    try { fs.unlinkSync(lp); } catch { /* ignore */ }
    return false;
  }
}

function acquireLock(accountId: string): boolean {
  ensureLockDir();
  const lp = lockPath(accountId);
  const data: LockData = { pid: process.pid, ts: new Date().toISOString() };

  try {
    // O_EXCL: fail if file already exists (atomic)
    fs.writeFileSync(lp, JSON.stringify(data), { flag: 'wx' });
    return true;
  } catch {
    // File exists — check if it's our own stale lock or another process
    if (!isLockValid(accountId)) {
      // Stale or same-PID lock — force overwrite (isLockValid may not unlink
      // same-PID files, so 'wx' would fail again; use plain write instead)
      try {
        fs.writeFileSync(lp, JSON.stringify(data));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

function releaseLock(accountId: string): void {
  const lp = lockPath(accountId);
  if (!fs.existsSync(lp)) return;

  try {
    const raw = fs.readFileSync(lp, 'utf-8');
    const lock: LockData = JSON.parse(raw);
    // Only release our own lock
    if (lock.pid === process.pid) {
      fs.unlinkSync(lp);
    }
  } catch {
    // Best effort
  }
}

/** Release all locks held by this process (call on shutdown). */
export function releaseAllLocks(): void {
  ensureLockDir();
  try {
    for (const file of fs.readdirSync(LOCK_DIR)) {
      if (!file.endsWith('.lock')) continue;
      const accountId = file.replace('.lock', '');
      releaseLock(accountId);
    }
  } catch {
    // Best effort
  }
}

// ─── Auth Config Types ─────────────────────────────────────

interface AuthAccount {
  email: string;
  password: string;
  /** Actual NS account ID when the key is a slot name (e.g. "5582598-sb2:account2"). Falls back to the key itself. */
  accountId?: string;
  securityQuestions?: Record<string, string>;
}

interface AuthConfig {
  accounts: Record<string, AuthAccount>;
}

// ─── Login Result ──────────────────────────────────────────

interface NsLoginData {
  loggedIn: boolean;
  account: string;
  slot?: string; // slot key from auth.json (e.g. "5582598-sb2:account2")
  requires2FA?: boolean;
  error?: string;
}

// ─── Constants ─────────────────────────────────────────────

const NS_LOGIN_URL = 'https://system.netsuite.com/pages/customerlogin.jsp';

const DEFAULT_AUTH_PATH = path.join(
  process.env.HOME || '/tmp',
  '.steez',
  'browse',
  'auth.json',
);

// ─── Helpers ───────────────────────────────────────────────

/**
 * Read and validate auth config from disk.
 * Returns the parsed config or a descriptive error string.
 */
function readAuthConfig(authPath: string): AuthConfig | string {
  if (!fs.existsSync(authPath)) {
    return [
      `Auth config not found at ${authPath}.`,
      '',
      'Create it with this format (file must be chmod 600):',
      '',
      '  {',
      '    "accounts": {',
      '      "ACCOUNT_ID": {',
      '        "email": "you@example.com",',
      '        "password": "your-password",',
      '        "securityQuestions": {',
      '          "What is your pet name?": "Fluffy"',
      '        }',
      '      }',
      '    }',
      '  }',
      '',
      `Then: chmod 600 ${authPath}`,
    ].join('\n');
  }

  // Check file permissions (Unix only — skip on Windows)
  if (process.platform !== 'win32') {
    const stat = fs.statSync(authPath);
    const mode = (stat.mode & 0o777).toString(8);
    if (mode !== '600') {
      return `Auth config ${authPath} has insecure permissions (${mode}). Run: chmod 600 ${authPath}`;
    }
  }

  try {
    const raw = fs.readFileSync(authPath, 'utf-8');
    const config = JSON.parse(raw) as AuthConfig;

    if (!config.accounts || typeof config.accounts !== 'object') {
      return 'Auth config is missing the "accounts" object.';
    }

    const accountIds = Object.keys(config.accounts);
    if (accountIds.length === 0) {
      return 'Auth config has no accounts defined.';
    }

    return config;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return `Failed to read auth config: ${message}`;
  }
}

/**
 * Parse ns login args: [--account <id>] [--release]
 */
function parseLoginArgs(args: string[]): { account: string | null; release: boolean } {
  let account: string | null = null;
  let release = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--account' && i + 1 < args.length) {
      account = args[++i];
    } else if (args[i] === '--release') {
      release = true;
    }
  }

  return { account, release };
}

// ─── Main Command ──────────────────────────────────────────

export async function nsLogin(
  args: string[],
  bm: BrowserManager,
  _authPath?: string,
  _loginUrl?: string,
): Promise<NsCommandOutput> {
  const start = Date.now();
  const authPath = _authPath ?? DEFAULT_AUTH_PATH;
  const loginUrl = _loginUrl ?? NS_LOGIN_URL;

  // 1. Read auth config
  const configOrError = readAuthConfig(authPath);
  if (typeof configOrError === 'string') {
    return { display: formatNsError('ns login', validationError(configOrError)), ok: false };
  }

  const config = configOrError;

  // 2. Resolve account (with locking)
  const { account: requestedAccount, release } = parseLoginArgs(args);
  const accountIds = Object.keys(config.accounts);

  // Handle --release: release all locks held by this process
  if (release) {
    releaseAllLocks();
    return { display: 'LOGIN OK | Locks released', ok: true };
  }

  let accountId: string;
  if (requestedAccount) {
    if (!config.accounts[requestedAccount]) {
      return {
        display: formatNsError('ns login', validationError(
          `Account "${requestedAccount}" not found in auth config. Available: ${accountIds.join(', ')}`,
        )),
        ok: false,
      };
    }
    accountId = requestedAccount;
  } else {
    const available = accountIds.find(id => !isLockValid(id));
    if (!available) {
      return {
        display: formatNsError('ns login', validationError(
          `All accounts are locked by other sessions. Available accounts: ${accountIds.join(', ')}. Use --release in the other session or wait for locks to expire (2h TTL).`,
        )),
        ok: false,
      };
    }
    accountId = available;
  }

  // Acquire lock
  if (!acquireLock(accountId)) {
    return {
      display: formatNsError('ns login', validationError(
        `Account "${accountId}" was claimed by another session. Try again or specify --account <id>.`,
      )),
      ok: false,
    };
  }

  const creds = config.accounts[accountId];
  const nsAccountId = creds.accountId || accountId;

  // 3. Navigate and fill credentials under mutex
  const result = await withMutex(nsMutex, async (): Promise<NsResult<NsLoginData>> => {
    try {
      const page = bm.getPage();

      await page.goto(loginUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });

      // Fill email
      const emailField = page.locator('#userName, input[name="email"]').first();
      await emailField.waitFor({ state: 'visible', timeout: 10000 });
      await emailField.fill(creds.email);

      // Fill password
      const passwordField = page.locator('#password, input[name="password"]').first();
      await passwordField.waitFor({ state: 'visible', timeout: 5000 });
      await passwordField.fill(creds.password);

      // Click login
      const submitButton = page.locator('#login-submit, #submitButton, button[type="submit"], input[type="submit"]').first();
      await submitButton.click();

      // Wait for navigation past intermediate redirects (transport.nl, etc.)
      await page.waitForURL(
        (url) => {
          const p = url.pathname.toLowerCase();
          return !p.includes('customerlogin') && !p.includes('transport.nl');
        },
        { timeout: 30000, waitUntil: 'domcontentloaded' },
      );

      // 4. Detect post-login state
      const currentUrl = page.url();

      // Check for 2FA page
      const has2FA = await page.locator(
        'input[name="verification_code"], input[name="otp"], #verification-code, input[type="tel"][maxlength="6"]',
      ).count().then(c => c > 0).catch(() => false);

      if (has2FA) {
        return { ok: true as const, data: { loggedIn: false, account: nsAccountId, slot: accountId, requires2FA: true } };
      }

      // Check for security question page
      const onSecurityQuestionPage = new URL(currentUrl).pathname.toLowerCase().includes('securityquestions.nl');

      if (onSecurityQuestionPage) {
        if (!creds.securityQuestions || Object.keys(creds.securityQuestions).length === 0) {
          return { ok: false as const, error: validationError('Security question page detected but no securityQuestions configured in auth.json') };
        }

        const pageText = await page.locator('body').innerText().catch(() => null);

        if (pageText) {
          const normalizedPage = pageText.trim().toLowerCase();
          let answer: string | null = null;

          for (const [q, a] of Object.entries(creds.securityQuestions)) {
            if (normalizedPage.includes(q.toLowerCase().trim())) {
              answer = a;
              break;
            }
          }

          if (answer) {
            const answerField = page.locator('input[name="answer"], input[type="text"]:visible, input[type="password"]:visible').first();
            await answerField.fill(answer);

            const securitySubmit = page.locator(
              'input[type="submit"]:visible, button[type="submit"]:visible',
            ).first();
            await securitySubmit.click();

            await page.waitForURL((url) => !url.pathname.toLowerCase().includes('securityquestions.nl'), { timeout: 15000 });
          } else {
            return { ok: false as const, error: validationError(`Security question not matched. Page text: "${pageText.trim().slice(0, 200)}"`) };
          }
        }
      }

      // 5. Detect success
      const finalUrl = page.url();
      const isLoggedIn = await detectLoginSuccess(page, finalUrl);

      if (!isLoggedIn) {
        return { ok: false as const, error: validationError(`Landed on ${finalUrl} — login may have failed`) };
      }

      return { ok: true as const, data: { loggedIn: true, account: nsAccountId, slot: accountId } };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: validationError(`Login failed: ${message}`) };
    }
  }, { label: 'ns login', operationTimeoutMs: 60000 });

  // ── Format output ──────────────────────────────────────────
  if (!result.ok) {
    return { display: formatNsError('ns login', result.error!), ok: false };
  }

  const d = result.data!;
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (d.requires2FA) {
    return {
      display: `LOGIN PENDING | Account: ${d.account} | Requires 2FA — enter code manually`,
      ok: true,
      metadata: buildLoginMetadata(d.account),
    };
  }

  return {
    display: `LOGIN OK | Account: ${d.account} | ${elapsed}s`,
    ok: true,
    metadata: buildLoginMetadata(d.account),
  };
}

function buildLoginMetadata(account: string): NsMetadata {
  const metadata: NsMetadata = {};
  if (/_SB\d*/i.test(account) || /sandbox/i.test(account)) {
    metadata.environment = 'sandbox';
  } else {
    metadata.environment = 'production';
  }
  return metadata;
}

/**
 * Detect whether login succeeded by checking the post-login URL
 * and probing for NS client API availability.
 */
async function detectLoginSuccess(
  page: import('playwright').Page,
  url: string,
): Promise<boolean> {
  const pathname = new URL(url).pathname.toLowerCase();

  // Still on credential login page → not logged in
  if (pathname.includes('/pages/customerlogin')) {
    return false;
  }
  // Other /app/login/ pages (e.g. error, role select) — but exclude
  // securityquestions.nl which is a valid mid-flow page handled separately
  if (pathname.includes('/app/login') && !pathname.includes('securityquestions.nl')) {
    return false;
  }

  // Redirected to a dashboard or record page → success
  if (
    /\/app\/center/i.test(url) ||
    /\/app\/accounting/i.test(url) ||
    /\/app\/common/i.test(url) ||
    /\/app\/site/i.test(url)
  ) {
    return true;
  }

  // Check if NS client API is available (strong signal of logged-in state)
  const hasNsApi = await page.evaluate(() => {
    return typeof (window as any).nlapiGetField === 'function';
  }).catch(() => false);

  if (hasNsApi) return true;

  // If URL is no longer the login page and we're on the same origin, assume success
  if (!url.includes('customerlogin') && !url.includes('/login')) {
    return true;
  }

  return false;
}
