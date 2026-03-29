/**
 * ns login — Automated NetSuite login using stored credentials.
 *
 * Usage:
 *   ns login                     → login using default (first) account from auth config
 *   ns login --account 12345_SB1 → login to specific account
 *
 * Auth config is read from ~/.steez/browse/auth.json (must be 600 perms).
 * Format:
 *   {
 *     "accounts": {
 *       "<accountId>": {
 *         "email": "...",
 *         "password": "...",
 *         "securityQuestions": { "question text": "answer" }
 *       }
 *     }
 *   }
 *
 * Handles:
 *   - Credential fill + submit
 *   - Security question detection + answer
 *   - 2FA detection (returns requires2FA, does not solve)
 *   - Success detection via URL redirect or NS client API presence
 */

import * as fs from 'fs';
import * as path from 'path';
import type { BrowserManager } from '../../core/browser-manager';
import type { NsCommandResult } from '../errors';
import { nsOk, nsFail, validationError } from '../errors';
import { withMutex, nsMutex } from '../mutex';

// ─── Auth Config Types ─────────────────────────────────────

interface AuthAccount {
  email: string;
  password: string;
  securityQuestions?: Record<string, string>;
}

interface AuthConfig {
  accounts: Record<string, AuthAccount>;
}

// ─── Login Result ──────────────────────────────────────────

interface NsLoginData {
  loggedIn: boolean;
  account: string;
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
 * Parse ns login args: [--account <id>]
 */
function parseLoginArgs(args: string[]): { account: string | null } {
  let account: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--account' && i + 1 < args.length) {
      account = args[++i];
    }
  }

  return { account };
}

// ─── Main Command ──────────────────────────────────────────

export async function nsLogin(
  args: string[],
  bm: BrowserManager,
  _authPath?: string,
  _loginUrl?: string,
): Promise<string> {
  const start = Date.now();
  const authPath = _authPath ?? DEFAULT_AUTH_PATH;
  const loginUrl = _loginUrl ?? NS_LOGIN_URL;

  // 1. Read auth config
  const configOrError = readAuthConfig(authPath);
  if (typeof configOrError === 'string') {
    const result: NsCommandResult = nsFail(
      validationError(configOrError),
      Date.now() - start,
    );
    return JSON.stringify(result);
  }

  const config = configOrError;

  // 2. Resolve account
  const { account: requestedAccount } = parseLoginArgs(args);
  const accountIds = Object.keys(config.accounts);

  let accountId: string;
  if (requestedAccount) {
    if (!config.accounts[requestedAccount]) {
      const result: NsCommandResult = nsFail(
        validationError(
          `Account "${requestedAccount}" not found in auth config. Available: ${accountIds.join(', ')}`,
        ),
        Date.now() - start,
      );
      return JSON.stringify(result);
    }
    accountId = requestedAccount;
  } else {
    accountId = accountIds[0];
  }

  const creds = config.accounts[accountId];

  // 3. Navigate and fill credentials under mutex
  return withMutex(nsMutex, async () => {
    try {
      const page = bm.getPage();

      // Navigate to NS login page
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
      const submitButton = page.locator('#submitButton, input[type="submit"]').first();
      await submitButton.click();

      // Wait for navigation after login
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 });

      // 4. Detect post-login state
      const currentUrl = page.url();

      // Check for 2FA page
      const has2FA = await page.locator(
        'input[name="verification_code"], input[name="otp"], #verification-code, input[type="tel"][maxlength="6"]',
      ).count().then(c => c > 0).catch(() => false);

      if (has2FA) {
        const data: NsLoginData = {
          loggedIn: false,
          account: accountId,
          requires2FA: true,
        };
        const result: NsCommandResult<NsLoginData> = nsOk(data, Date.now() - start);
        return JSON.stringify(result);
      }

      // Check for security question page
      const securityQuestionEl = await page.locator(
        '#securityquestion, .security-question, input[name="answer"], #answer',
      ).first().isVisible().catch(() => false);

      if (securityQuestionEl && creds.securityQuestions) {
        // Try to read the question text
        const questionText = await page.locator(
          '#securityquestion, .security-question, label[for="answer"]',
        ).first().textContent().catch(() => null);

        if (questionText) {
          // Match against stored security Q&A (case-insensitive, trimmed)
          const normalizedQuestion = questionText.trim().toLowerCase();
          let answer: string | null = null;

          for (const [q, a] of Object.entries(creds.securityQuestions)) {
            if (normalizedQuestion.includes(q.toLowerCase().trim())) {
              answer = a;
              break;
            }
          }

          if (answer) {
            const answerField = page.locator('input[name="answer"], #answer').first();
            await answerField.fill(answer);

            const securitySubmit = page.locator(
              'input[type="submit"], button[type="submit"]',
            ).first();
            await securitySubmit.click();

            await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
          }
        }
      }

      // 5. Detect success
      const finalUrl = page.url();
      const isLoggedIn = await detectLoginSuccess(page, finalUrl);

      const data: NsLoginData = {
        loggedIn: isLoggedIn,
        account: accountId,
        ...(isLoggedIn ? {} : { error: `Landed on ${finalUrl} — login may have failed` }),
      };

      const result: NsCommandResult<NsLoginData> = nsOk(data, Date.now() - start);
      return JSON.stringify(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const data: NsLoginData = {
        loggedIn: false,
        account: accountId,
        error: message,
      };
      const result: NsCommandResult<NsLoginData> = nsFail(
        validationError(`Login failed: ${message}`),
        Date.now() - start,
      );
      return JSON.stringify(result);
    }
  }, { label: 'ns login', operationTimeoutMs: 30000 });
}

/**
 * Detect whether login succeeded by checking the post-login URL
 * and probing for NS client API availability.
 */
async function detectLoginSuccess(
  page: import('playwright').Page,
  url: string,
): Promise<boolean> {
  // Still on login page → not logged in
  if (/\/pages\/customerlogin/i.test(url) || /\/app\/login/i.test(url)) {
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
