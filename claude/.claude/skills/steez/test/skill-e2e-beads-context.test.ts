/**
 * Beads Context preamble integration tests.
 *
 * Verifies that steez skill preambles correctly invoke steez-bd resume
 * from ~/.steez/.beads/ (not project .beads/), and that skill execution
 * does not pollute the project directory with beads state.
 *
 * Tier 1: Static + script validation — no API calls, <5s.
 *   - All SKILL.md Beads Context sections reference correct steez-bd path
 *   - steez-bd script hardcodes BEADS_DIR to ~/.steez/.beads/
 *   - steez-bd resume runs without creating .beads/ in working directory
 *   - steez-bd resume output format matches expectations
 *   - steez-bd resume shows bead info when in-progress beads exist
 *
 * Tier 2: E2E via claude -p — requires EVALS=1.
 *   - Spawn claude with a skill's preamble + Beads Context blocks
 *   - Verify transcript shows steez-bd execution
 *   - Verify no .beads/ created in project working directory
 *
 * Run with:
 *   bun test test/skill-e2e-beads-context.test.ts           # tier 1 only
 *   EVALS=1 bun test test/skill-e2e-beads-context.test.ts   # tier 1 + tier 2
 *
 * Cost: tier 1 = free, tier 2 ≈ $0.15 (Sonnet, 5 max turns)
 */

import { describe, test, expect, afterAll } from 'bun:test';
import { discoverSkillFiles } from './helpers/skill-parser';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ROOT = path.resolve(import.meta.dir, '..');
const STEEZ_BD = path.join(os.homedir(), '.claude', 'skills', 'steez', 'bin', 'steez-bd');
const ALL_SKILLS = discoverSkillFiles(ROOT);

// ─── Tier 1: Static + Script Validation ──────────────────────────

describe('Beads Context preamble validation', () => {

  // Discover skills that have a ## Beads Context section
  const skillsWithBeadsContext = ALL_SKILLS.filter(s => {
    const content = fs.readFileSync(s.path, 'utf-8');
    return content.includes('## Beads Context');
  });

  test('at least one skill has a Beads Context section', () => {
    expect(skillsWithBeadsContext.length).toBeGreaterThan(0);
  });

  for (const skill of skillsWithBeadsContext) {
    test(`${skill.name}: Beads Context calls steez-bd resume at correct path`, () => {
      const content = fs.readFileSync(skill.path, 'utf-8');

      // Extract the Beads Context section (between ## Beads Context and next ##)
      const beadsIdx = content.indexOf('## Beads Context');
      expect(beadsIdx).toBeGreaterThan(-1);

      const afterBeads = content.slice(beadsIdx);
      const nextSection = afterBeads.indexOf('\n## ', 1);
      const beadsSection = nextSection > 0
        ? afterBeads.slice(0, nextSection)
        : afterBeads;

      // Must contain the steez-bd resume call with correct absolute path
      expect(beadsSection).toContain('"$HOME/.claude/skills/steez/bin/steez-bd" resume');

      // Must be non-blocking (|| true or 2>/dev/null)
      expect(beadsSection).toMatch(/steez-bd.*resume.*(\|\| true|2>\/dev\/null)/);
    });
  }

  test('steez-bd script sets BEADS_DIR to ~/.steez/.beads', () => {
    const script = fs.readFileSync(STEEZ_BD, 'utf-8');
    expect(script).toContain('BEADS_DIR="$HOME/.steez/.beads"');
    // Must export it so bd subprocesses inherit the path
    expect(script).toContain('export BEADS_DIR');
  });

  test('steez-bd script does NOT reference project-scoped .beads/', () => {
    const script = fs.readFileSync(STEEZ_BD, 'utf-8');
    const lines = script.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments
      if (line.trimStart().startsWith('#')) continue;
      // Should not cd into or reference a project .beads/ directory
      expect(line).not.toMatch(/\.\/(\.beads|beads)\//);
      // Should not call bd init without BEADS_DIR context
      if (line.includes('bd init')) {
        // The init block should be inside the auto-init guard that uses BEADS_DIR
        const contextWindow = lines.slice(Math.max(0, i - 5), i + 1).join('\n');
        expect(contextWindow).toContain('BEADS_DIR');
      }
    }
  });
});

// ─── Tier 1: Script execution tests ─────────────────────────────

describe('steez-bd resume isolation', () => {

  test('steez-bd resume does not create .beads/ in working directory', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beads-isolation-'));
    try {
      const result = spawnSync(STEEZ_BD, ['resume'], {
        cwd: tmpDir,
        stdio: 'pipe',
        timeout: 15_000,
        env: { ...process.env, HOME: os.homedir() },
      });

      // Should exit cleanly (0) — the || true in preamble is a safety net,
      // but the script itself should handle empty state gracefully
      expect(result.status).toBe(0);

      // The critical assertion: no .beads/ directory in the project dir
      expect(fs.existsSync(path.join(tmpDir, '.beads'))).toBe(false);

      // Also verify no beads metadata leaked
      const contents = fs.readdirSync(tmpDir);
      const beadsRelated = contents.filter(f =>
        f.includes('bead') || f.includes('.beads') || f === 'metadata.json'
      );
      expect(beadsRelated).toHaveLength(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('steez-bd resume produces valid output when no beads exist', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beads-output-'));
    try {
      const result = spawnSync(STEEZ_BD, ['resume'], {
        cwd: tmpDir,
        stdio: 'pipe',
        timeout: 15_000,
        env: { ...process.env, HOME: os.homedir() },
      });

      const stdout = result.stdout?.toString() || '';
      const stderr = result.stderr?.toString() || '';
      const combined = stdout + stderr;

      // When no beads are active, output should indicate that clearly
      // Either "No active or ready beads." or shows READY BEADS: 0
      const hasNoBeadsMsg = combined.includes('No active or ready beads');
      const hasReadyCount = combined.match(/READY BEADS: \d+/);
      const hasCurrentBead = combined.includes('CURRENT BEAD:');

      // At minimum, one of these patterns must appear — the script
      // should always produce meaningful output
      expect(hasNoBeadsMsg || hasReadyCount || hasCurrentBead).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('steez-bd resume shows bead info when in-progress beads exist', () => {
    // Create a temporary test bead in the steez beads database
    const createResult = spawnSync('bash', ['-c',
      `export BEADS_DIR="$HOME/.steez/.beads" && bd create --title="[TEST] beads-context-e2e-probe" --type=task --priority=4 --silent 2>/dev/null`,
    ], { stdio: 'pipe', timeout: 15_000 });

    const beadId = createResult.stdout?.toString().trim();
    if (!beadId || createResult.status !== 0) {
      // If we can't create a bead (bd not available, server down, etc.), skip gracefully
      console.warn('Skipping in-progress bead test: could not create test bead');
      return;
    }

    try {
      // Claim the bead to put it in_progress
      spawnSync('bash', ['-c',
        `export BEADS_DIR="$HOME/.steez/.beads" && bd update "${beadId}" --claim 2>/dev/null`,
      ], { stdio: 'pipe', timeout: 10_000 });

      // Run steez-bd resume and check output
      const result = spawnSync(STEEZ_BD, ['resume'], {
        cwd: os.tmpdir(),
        stdio: 'pipe',
        timeout: 15_000,
      });

      const stdout = result.stdout?.toString() || '';

      // Should show the test bead as current
      expect(stdout).toContain('CURRENT BEAD:');
      expect(stdout).toContain(beadId);
      expect(stdout).toContain('beads-context-e2e-probe');
      expect(stdout).toContain('STATUS: in_progress');
    } finally {
      // Clean up: close and delete the test bead
      spawnSync('bash', ['-c',
        `export BEADS_DIR="$HOME/.steez/.beads" && bd close "${beadId}" --reason="test cleanup" 2>/dev/null`,
      ], { stdio: 'pipe', timeout: 10_000 });
    }
  });
});

// ─── Tier 2: E2E via claude -p ───────────────────────────────────

import { runSkillTest } from './helpers/session-runner';
import {
  ROOT as HELPERS_ROOT, evalsEnabled, runId,
  logCost, createEvalCollector, finalizeEvalCollector, recordE2E,
  testIfSelected, selectedTests,
} from './helpers/e2e-helpers';

const evalCollector = createEvalCollector('e2e-beads-context');

const describeE2E = evalsEnabled ? describe : describe.skip;

describeE2E('Beads Context E2E', () => {
  // Read a real skill's preamble + Beads Context to use as the prompt
  const shipSkillPath = ALL_SKILLS.find(s => s.name === 'steez-ship')?.path;
  let preambleBash = '';
  let beadsContextBash = '';

  if (shipSkillPath && fs.existsSync(shipSkillPath)) {
    const content = fs.readFileSync(shipSkillPath, 'utf-8');

    // Extract Preamble bash block
    const preambleMatch = content.match(/## Preamble \(run first\)\s*\n\s*```bash\n([\s\S]*?)```/);
    if (preambleMatch) preambleBash = preambleMatch[1].trim();

    // Extract Beads Context bash block
    const beadsMatch = content.match(/## Beads Context\s*\n\s*```bash\n([\s\S]*?)```/);
    if (beadsMatch) beadsContextBash = beadsMatch[1].trim();
  }

  testIfSelected('beads-preamble', async () => {
    const testWorkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-e2e-beads-'));

    // Initialize a git repo so the preamble's git commands work
    spawnSync('git', ['init', '-q'], { cwd: testWorkDir, stdio: 'pipe' });
    spawnSync('git', ['commit', '--allow-empty', '-m', 'init', '-q'], {
      cwd: testWorkDir, stdio: 'pipe',
    });

    try {
      const prompt = `You are testing the steez beads context preamble. Run these two bash blocks in order and report what you see.

BLOCK 1 — Preamble:
\`\`\`bash
${preambleBash}
\`\`\`

BLOCK 2 — Beads Context:
\`\`\`bash
${beadsContextBash}
\`\`\`

After running both blocks, check if a .beads/ directory exists in the current working directory:
\`\`\`bash
ls -la .beads/ 2>&1 || echo "NO_BEADS_DIR_IN_PROJECT"
\`\`\`

Report what each block output. If the Beads Context block showed bead information, include it. Done.`;

      const result = await runSkillTest({
        prompt,
        workingDirectory: testWorkDir,
        maxTurns: 5,
        allowedTools: ['Bash', 'Read'],
        timeout: 60_000,
        testName: 'beads-preamble',
        runId,
        model: 'claude-sonnet-4-6',
      });

      logCost('beads-preamble', result);

      // Verify steez-bd was executed in the transcript
      const transcriptText = JSON.stringify(result.transcript);
      expect(transcriptText).toContain('steez-bd');

      // Verify no .beads/ directory was created in the project
      expect(fs.existsSync(path.join(testWorkDir, '.beads'))).toBe(false);

      // Verify the output mentions beads context (either real beads or "No active")
      const outputAndTranscript = result.output + transcriptText;
      const hasBeadsOutput =
        outputAndTranscript.includes('No active or ready beads') ||
        outputAndTranscript.includes('CURRENT BEAD') ||
        outputAndTranscript.includes('READY BEADS');
      expect(hasBeadsOutput).toBe(true);

      // Verify the .beads check ran and confirmed no pollution
      expect(outputAndTranscript).toContain('NO_BEADS_DIR_IN_PROJECT');

      recordE2E(evalCollector, 'beads-preamble', 'Beads Context E2E', result, {
        passed: result.exitReason === 'success' && !fs.existsSync(path.join(testWorkDir, '.beads')),
      });
    } finally {
      fs.rmSync(testWorkDir, { recursive: true, force: true });
    }
  }, 90_000);
});

afterAll(async () => {
  await finalizeEvalCollector(evalCollector);
});
