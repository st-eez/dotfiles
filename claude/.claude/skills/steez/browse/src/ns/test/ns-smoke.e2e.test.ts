/**
 * E2E smoke tests for NS commands against a live NetSuite sandbox.
 *
 * These tests are SCAFFOLDING for manual validation. They will NOT pass
 * without a live sandbox environment. The `--ignore '**\/*e2e*'` pattern
 * in package.json excludes this file from default test runs.
 *
 * To run:
 *   NS_SANDBOX_URL=https://your-account.app.netsuite.com bun test src/ns/test/ns-smoke.e2e.test.ts
 *
 * Prerequisites:
 *   - NS_SANDBOX_URL env var set to your sandbox origin
 *   - Auth config at ~/.steez/browse/auth.json (chmod 600) with sandbox credentials
 *   - Placeholder values below replaced with real customer/vendor/item IDs from sandbox
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { handleNsCommand } from '../ns-commands';
import { BrowserManager } from '../../core/browser-manager';

// ─── Environment Gate ──────────────────────────────────────────
// Skip the entire suite unless NS_SANDBOX_URL is set.

const SANDBOX_URL = process.env.NS_SANDBOX_URL;
const describeE2E = SANDBOX_URL ? describe : describe.skip;

// ─── Placeholder Values ────────────────────────────────────────
// Replace these with actual IDs from your sandbox before running.

const CUSTOMER_ID = '12345';       // Replace with actual customer internal ID from sandbox
const VENDOR_ID = '67890';         // Replace with actual vendor internal ID from sandbox
const ITEM_1 = 'Widget A';        // Replace with actual item name or ID from sandbox
const ITEM_2 = 'Widget B';        // Replace with actual item name or ID from sandbox

// ─── Test Helpers ──────────────────────────────────────────────

/** Execute an NS command via the dispatcher and return parsed JSON. */
async function ns(command: string, bm: BrowserManager): Promise<any> {
  const parts = command.split(/\s+/);
  const fullCommand = `ns ${parts[0]}`;
  const args = parts.slice(1);
  const start = Date.now();
  const raw = await handleNsCommand(fullCommand, args, bm);
  const result = JSON.parse(raw);
  const elapsed = result.elapsedMs ?? (Date.now() - start);
  console.log(`  [ns ${parts[0]}] ${result.ok ? 'OK' : 'FAIL'} (${elapsed}ms)`);
  return result;
}

/** Track command stats within a workflow. */
interface WorkflowStats {
  commands: number;
  errors: number;
  totalMs: number;
}

function newStats(): WorkflowStats {
  return { commands: 0, errors: 0, totalMs: 0 };
}

function track(stats: WorkflowStats, result: any): void {
  stats.commands++;
  stats.totalMs += result.elapsedMs ?? 0;
  if (!result.ok) stats.errors++;
}

// ─── Browser Lifecycle ─────────────────────────────────────────

let bm: BrowserManager;

describeE2E('NS E2E Smoke Tests', () => {
  beforeAll(async () => {
    bm = new BrowserManager();
    await bm.launch();

    // Navigate to sandbox origin so cookies/session are scoped correctly
    if (SANDBOX_URL) {
      await bm.getPage().goto(SANDBOX_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    }
  }, 60000); // 60s timeout for browser launch + initial navigation

  afterAll(async () => {
    try { await bm.close(); } catch {}
  });

  // ─── 1. Create Sales Order ────────────────────────────────

  describeE2E('Workflow: Create Sales Order', () => {
    const stats = newStats();

    test('login (or verify session)', async () => {
      const result = await ns('login', bm);
      track(stats, result);
      expect(result.ok).toBe(true);
      // Login may return loggedIn: true or requires2FA — both are valid
      if (result.data?.requires2FA) {
        console.log('  [!] 2FA required — complete manually before continuing');
      }
    }, 30000);

    test('navigate to new sales order', async () => {
      const result = await ns('navigate salesorder', bm);
      track(stats, result);
      expect(result.ok).toBe(true);
      expect(result.data.recordType).toBe('salesorder');
      expect(result.data.mode).toBe('create');
    }, 15000);

    test('inspect new SO form', async () => {
      const result = await ns('inspect', bm);
      track(stats, result);
      expect(result.ok).toBe(true);
      // A new SO form should have fields but no internal ID yet
      expect(result.data).toBeDefined();
    }, 10000);

    test('set customer (entity sourcing)', async () => {
      const result = await ns(`set entity ${CUSTOMER_ID}`, bm);
      track(stats, result);
      expect(result.ok).toBe(true);
      // Entity sourcing populates subsidiary, currency, terms, etc.
      // Allow extra time for sourcing cascade
    }, 20000);

    test('inspect after entity sourcing', async () => {
      const result = await ns('inspect', bm);
      track(stats, result);
      expect(result.ok).toBe(true);
      // After sourcing, we expect more fields to be populated
      expect(result.data).toBeDefined();
    }, 10000);

    test('add first item line (qty 2)', async () => {
      const result = await ns(`add-row item item=${ITEM_1} quantity=2`, bm);
      track(stats, result);
      expect(result.ok).toBe(true);
    }, 15000);

    test('add second item line (qty 1)', async () => {
      const result = await ns(`add-row item item=${ITEM_2} quantity=1`, bm);
      track(stats, result);
      expect(result.ok).toBe(true);
    }, 15000);

    test('save the sales order', async () => {
      const result = await ns('save', bm);
      track(stats, result);
      expect(result.ok).toBe(true);
      // Save should return the new record ID
      expect(result.data?.id).toBeDefined();
      console.log(`  [+] Created SO #${result.data?.id}`);
    }, 30000);

    test('verify saved record', async () => {
      const result = await ns('verify --current', bm);
      track(stats, result);
      expect(result.ok).toBe(true);
      // Record should have an internal ID after save
      expect(result.data).toBeDefined();
    }, 10000);

    test('workflow stats', () => {
      console.log(`  [stats] Commands: ${stats.commands}, Errors: ${stats.errors}, Total: ${stats.totalMs}ms`);
      expect(stats.errors).toBe(0);
    });
  });

  // ─── 2. Create Purchase Order ─────────────────────────────

  describeE2E('Workflow: Create Purchase Order', () => {
    const stats = newStats();

    test('navigate to new purchase order', async () => {
      const result = await ns('navigate purchaseorder', bm);
      track(stats, result);
      expect(result.ok).toBe(true);
      expect(result.data.recordType).toBe('purchaseorder');
      expect(result.data.mode).toBe('create');
    }, 15000);

    test('set vendor (entity)', async () => {
      const result = await ns(`set entity ${VENDOR_ID}`, bm);
      track(stats, result);
      expect(result.ok).toBe(true);
    }, 20000);

    test('add first item line (qty 5)', async () => {
      const result = await ns(`add-row item item=${ITEM_1} quantity=5`, bm);
      track(stats, result);
      expect(result.ok).toBe(true);
    }, 15000);

    test('add second item line (qty 3)', async () => {
      const result = await ns(`add-row item item=${ITEM_2} quantity=3`, bm);
      track(stats, result);
      expect(result.ok).toBe(true);
    }, 15000);

    test('save the purchase order', async () => {
      const result = await ns('save', bm);
      track(stats, result);
      expect(result.ok).toBe(true);
      expect(result.data?.id).toBeDefined();
      console.log(`  [+] Created PO #${result.data?.id}`);
    }, 30000);

    test('verify saved PO', async () => {
      const result = await ns('verify --current', bm);
      track(stats, result);
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
    }, 10000);

    test('workflow stats', () => {
      console.log(`  [stats] Commands: ${stats.commands}, Errors: ${stats.errors}, Total: ${stats.totalMs}ms`);
      expect(stats.errors).toBe(0);
    });
  });

  // ─── 3. SuiteQL Query ────────────────────────────────────

  describeE2E('Workflow: SuiteQL Query', () => {
    const stats = newStats();

    test('query recent sales orders', async () => {
      const query = "SELECT id, tranid, trandate FROM transaction WHERE type = 'SalesOrd' AND trandate > '2026-01-01' FETCH FIRST 5 ROWS ONLY";
      const result = await ns(`query ${query}`, bm);
      track(stats, result);

      expect(result.ok).toBe(true);
      expect(result.data.rowCount).toBeGreaterThan(0);
      expect(result.data.rows).toBeInstanceOf(Array);
      expect(result.data.rows.length).toBeGreaterThan(0);

      // Each row should have id and tranid
      const firstRow = result.data.rows[0];
      expect(firstRow).toHaveProperty('id');
      expect(firstRow).toHaveProperty('tranid');

      console.log(`  [+] Found ${result.data.rowCount} sales orders`);
      console.log(`  [+] First: ${firstRow.tranid} (id=${firstRow.id})`);
    }, 15000);

    test('query with no results returns empty rows', async () => {
      const query = "SELECT id FROM transaction WHERE type = 'SalesOrd' AND tranid = 'NONEXISTENT_99999' FETCH FIRST 1 ROWS ONLY";
      const result = await ns(`query ${query}`, bm);
      track(stats, result);

      expect(result.ok).toBe(true);
      expect(result.data.rowCount).toBe(0);
      expect(result.data.rows).toEqual([]);
    }, 15000);

    test('workflow stats', () => {
      console.log(`  [stats] Commands: ${stats.commands}, Errors: ${stats.errors}, Total: ${stats.totalMs}ms`);
      expect(stats.errors).toBe(0);
    });
  });

  // ─── 4. Verify Created Records ───────────────────────────

  describeE2E('Workflow: Verify Created Records', () => {
    const stats = newStats();
    let foundSoId: string | null = null;
    let foundSoTranId: string | null = null;

    test('find a recent SO via SuiteQL', async () => {
      const query = "SELECT id, tranid, entity FROM transaction WHERE type = 'SalesOrd' AND trandate > '2026-01-01' ORDER BY id DESC FETCH FIRST 1 ROWS ONLY";
      const result = await ns(`query ${query}`, bm);
      track(stats, result);

      expect(result.ok).toBe(true);
      expect(result.data.rowCount).toBeGreaterThan(0);

      const row = result.data.rows[0];
      foundSoId = String(row.id);
      foundSoTranId = String(row.tranid);

      console.log(`  [+] Found SO: ${foundSoTranId} (id=${foundSoId})`);
    }, 15000);

    test('navigate to the found SO', async () => {
      expect(foundSoId).not.toBeNull();

      const result = await ns(`navigate salesorder --id ${foundSoId}`, bm);
      track(stats, result);

      expect(result.ok).toBe(true);
      expect(result.data.recordType).toBe('salesorder');
      expect(result.data.mode).toBe('view');
      expect(result.data.url).toContain(`id=${foundSoId}`);
    }, 15000);

    test('verify the SO fields', async () => {
      expect(foundSoId).not.toBeNull();

      // Verify the record is the one we navigated to.
      // entity value depends on your sandbox data — adjust as needed.
      const result = await ns(`verify --current tranid=${foundSoTranId}`, bm);
      track(stats, result);

      expect(result.ok).toBe(true);
      expect(result.data.verified).toBe(true);
      expect(result.data.matched.length).toBeGreaterThan(0);
    }, 15000);

    test('inspect the SO for full field snapshot', async () => {
      const result = await ns('inspect', bm);
      track(stats, result);
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
    }, 10000);

    test('workflow stats', () => {
      console.log(`  [stats] Commands: ${stats.commands}, Errors: ${stats.errors}, Total: ${stats.totalMs}ms`);
      expect(stats.errors).toBe(0);
    });
  });
});
