/**
 * Shared helpers for E2E test files.
 *
 * Ported from gstack/test/helpers/e2e-helpers.ts.
 * Key differences from gstack:
 *   - No worktree isolation (steez doesn't have lib/worktree.ts)
 *   - No preamble state pre-seeding (steez has no lake intro/telemetry/proactive prompts)
 *   - Browse fixtures at browse/src/core/test/fixtures/
 *   - test-server at browse/src/core/test/test-server.ts
 */

import { describe, test, beforeAll, afterAll } from 'bun:test';
import type { SkillTestResult } from './session-runner';
import { EvalCollector, judgePassed } from './eval-store';
import type { EvalTestEntry } from './eval-store';
import { selectTests, detectBaseBranch, getChangedFiles, E2E_TOUCHFILES, E2E_TIERS, GLOBAL_TOUCHFILES } from './touchfiles';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const ROOT = path.resolve(import.meta.dir, '..', '..');

// Skip unless EVALS=1.
export const evalsEnabled = !!process.env.EVALS;

// --- Diff-based test selection ---
export let selectedTests: string[] | null = null;

if (evalsEnabled && !process.env.EVALS_ALL) {
  const baseBranch = process.env.EVALS_BASE
    || detectBaseBranch(ROOT)
    || 'main';
  const changedFiles = getChangedFiles(baseBranch, ROOT);

  if (changedFiles.length > 0) {
    const selection = selectTests(changedFiles, E2E_TOUCHFILES, GLOBAL_TOUCHFILES);
    selectedTests = selection.selected;
    process.stderr.write(`\nE2E selection (${selection.reason}): ${selection.selected.length}/${Object.keys(E2E_TOUCHFILES).length} tests\n`);
    if (selection.skipped.length > 0) {
      process.stderr.write(`  Skipped: ${selection.skipped.join(', ')}\n`);
    }
    process.stderr.write('\n');
  }
}

if (evalsEnabled && process.env.EVALS_TIER) {
  const tier = process.env.EVALS_TIER as 'gate' | 'periodic';
  const tierTests = Object.entries(E2E_TIERS)
    .filter(([, t]) => t === tier)
    .map(([name]) => name);

  if (selectedTests === null) {
    selectedTests = tierTests;
  } else {
    selectedTests = selectedTests.filter(t => tierTests.includes(t));
  }
  process.stderr.write(`EVALS_TIER=${tier}: ${selectedTests.length} tests\n\n`);
}

export const describeE2E = evalsEnabled ? describe : describe.skip;

/** Wrap a describe block to skip entirely if none of its tests are selected. */
export function describeIfSelected(name: string, testNames: string[], fn: () => void) {
  const anySelected = selectedTests === null || testNames.some(t => selectedTests!.includes(t));
  (anySelected ? describeE2E : describe.skip)(name, fn);
}

// Unique run ID for this E2E session
export const runId = new Date().toISOString().replace(/[:.]/g, '').replace('T', '-').slice(0, 15);

export const browseBin = path.resolve(ROOT, 'browse', 'dist', 'browse');

// LLM judge uses `claude -p` (OAuth), no separate API key needed.
// Keep hasApiKey export for backward compat but always true.
export const hasApiKey = true;

/**
 * Copy a directory tree recursively (files only, follows structure).
 */
export function copyDirSync(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Set up browse shims (binary symlink, find-browse, remote-slug) in a tmpDir.
 */
export function setupBrowseShims(dir: string) {
  const binDir = path.join(dir, 'browse', 'dist');
  fs.mkdirSync(binDir, { recursive: true });
  if (fs.existsSync(browseBin)) {
    fs.symlinkSync(browseBin, path.join(binDir, 'browse'));
  }

  const findBrowseDir = path.join(dir, 'browse', 'bin');
  fs.mkdirSync(findBrowseDir, { recursive: true });
  fs.writeFileSync(
    path.join(findBrowseDir, 'find-browse'),
    `#!/bin/bash\necho "${browseBin}"\n`,
    { mode: 0o755 },
  );

  fs.writeFileSync(
    path.join(findBrowseDir, 'remote-slug'),
    `#!/bin/bash\necho "test-project"\n`,
    { mode: 0o755 },
  );
}

/**
 * Print cost summary after an E2E test.
 */
export function logCost(label: string, result: { costEstimate: { turnsUsed: number; estimatedTokens: number; estimatedCost: number }; duration: number }) {
  const { turnsUsed, estimatedTokens, estimatedCost } = result.costEstimate;
  const durationSec = Math.round(result.duration / 1000);
  console.log(`${label}: $${estimatedCost.toFixed(2)} (${turnsUsed} turns, ${(estimatedTokens / 1000).toFixed(1)}k tokens, ${durationSec}s)`);
}

/**
 * Dump diagnostic info on planted-bug outcome failure.
 */
export function dumpOutcomeDiagnostic(dir: string, label: string, report: string, judgeResult: any) {
  try {
    const transcriptDir = path.join(dir, '.steez', 'test-transcripts');
    fs.mkdirSync(transcriptDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(
      path.join(transcriptDir, `${label}-outcome-${timestamp}.json`),
      JSON.stringify({ label, report, judgeResult }, null, 2),
    );
  } catch { /* non-fatal */ }
}

/**
 * Create an EvalCollector for a specific suite.
 */
export function createEvalCollector(suite: string): EvalCollector | null {
  return evalsEnabled ? new EvalCollector(suite) : null;
}

/** DRY helper to record an E2E test result into the eval collector. */
export function recordE2E(
  evalCollector: EvalCollector | null,
  name: string,
  suite: string,
  result: SkillTestResult,
  extra?: Partial<EvalTestEntry>,
) {
  const lastTool = result.toolCalls.length > 0
    ? `${result.toolCalls[result.toolCalls.length - 1].tool}(${JSON.stringify(result.toolCalls[result.toolCalls.length - 1].input).slice(0, 60)})`
    : undefined;

  evalCollector?.addTest({
    name, suite, tier: 'e2e',
    passed: result.exitReason === 'success' && result.browseErrors.length === 0,
    duration_ms: result.duration,
    cost_usd: result.costEstimate.estimatedCost,
    transcript: result.transcript,
    output: result.output?.slice(0, 2000),
    turns_used: result.costEstimate.turnsUsed,
    browse_errors: result.browseErrors,
    exit_reason: result.exitReason,
    timeout_at_turn: result.exitReason === 'timeout' ? result.costEstimate.turnsUsed : undefined,
    last_tool_call: lastTool,
    model: result.model,
    first_response_ms: result.firstResponseMs,
    max_inter_turn_ms: result.maxInterTurnMs,
    ...extra,
  });
}

/** Finalize an eval collector (write results). */
export async function finalizeEvalCollector(evalCollector: EvalCollector | null) {
  if (evalCollector) {
    try {
      await evalCollector.finalize();
    } catch (err) {
      console.error('Failed to save eval results:', err);
    }
  }
}

// Fail fast if Anthropic API is unreachable
if (evalsEnabled) {
  const check = spawnSync('sh', ['-c', 'echo "ping" | claude -p --max-turns 1 --output-format stream-json --verbose --dangerously-skip-permissions'], {
    stdio: 'pipe', timeout: 30_000,
  });
  const output = check.stdout?.toString() || '';
  if (output.includes('ConnectionRefused') || output.includes('Unable to connect')) {
    throw new Error('Anthropic API unreachable — aborting E2E suite. Fix connectivity and retry.');
  }
}

/** Skip an individual test if not selected. */
export function testIfSelected(testName: string, fn: () => Promise<void>, timeout: number) {
  const shouldRun = selectedTests === null || selectedTests.includes(testName);
  (shouldRun ? test : test.skip)(testName, fn, timeout);
}

/** Concurrent version — runs in parallel with other concurrent tests. */
export function testConcurrentIfSelected(testName: string, fn: () => Promise<void>, timeout: number) {
  const shouldRun = selectedTests === null || selectedTests.includes(testName);
  (shouldRun ? test.concurrent : test.skip)(testName, fn, timeout);
}

export { judgePassed } from './eval-store';
export { EvalCollector } from './eval-store';
export type { EvalTestEntry } from './eval-store';
