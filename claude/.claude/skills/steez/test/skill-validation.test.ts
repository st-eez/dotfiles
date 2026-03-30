/**
 * Skill validation tests for steez.
 *
 * Tier 1: Static validation — no API calls, no browser, <2s.
 * Validates all SKILL.md files for command correctness, structural
 * consistency, and cross-skill coherence.
 *
 * Ported from gstack/test/skill-validation.test.ts.
 * Key differences from gstack:
 *   - Dynamic skill discovery (no hardcoded skill lists)
 *   - No template system (.tmpl) — steez SKILL.md files are hand-edited
 *   - steez- prefix instead of gstack-
 *   - ~/.steez/ instead of ~/.gstack/ for runtime paths
 *   - browse source at browse/src/core/ instead of browse/src/
 */

import { describe, test, expect } from 'bun:test';
import { validateSkill, extractRemoteSlugPatterns, extractWeightsFromTable, discoverSkillFiles } from './helpers/skill-parser';
import { ALL_COMMANDS, COMMAND_DESCRIPTIONS, READ_COMMANDS, WRITE_COMMANDS, META_COMMANDS, NS_COMMANDS, PLAYWRIGHT_COMMANDS } from '../browse/src/core/commands';
import { SNAPSHOT_FLAGS } from '../browse/src/core/snapshot';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');
const ALL_SKILLS = discoverSkillFiles(ROOT);

// Skills that use $B commands (browser-dependent skills)
const BROWSER_SKILLS = ALL_SKILLS.filter(s => {
  const content = fs.readFileSync(s.path, 'utf-8');
  return content.includes('$B ');
});

// ─── $B Command Validation ─────────────────────────────────────

describe('SKILL.md command validation', () => {
  // Dynamically test every steez skill that uses $B commands
  for (const skill of BROWSER_SKILLS) {
    test(`${skill.name}: all $B commands are valid browse commands`, () => {
      const result = validateSkill(skill.path);
      if (result.invalid.length > 0) {
        const details = result.invalid.map(c => `  line ${c.line}: ${c.raw}`).join('\n');
        throw new Error(`Invalid commands in ${skill.name}/SKILL.md:\n${details}`);
      }
    });

    test(`${skill.name}: all snapshot flags are valid`, () => {
      const result = validateSkill(skill.path);
      if (result.snapshotFlagErrors.length > 0) {
        const details = result.snapshotFlagErrors.map(e =>
          `  line ${e.command.line}: ${e.command.raw} — ${e.error}`
        ).join('\n');
        throw new Error(`Invalid snapshot flags in ${skill.name}/SKILL.md:\n${details}`);
      }
    });
  }

  // Also validate the steez-browse SKILL.md specifically (it's the command reference)
  test('steez-browse SKILL.md has $B commands and all are valid', () => {
    const browseSkill = ALL_SKILLS.find(s => s.name === 'steez-browse');
    expect(browseSkill).toBeDefined();
    const result = validateSkill(browseSkill!.path);
    expect(result.valid.length).toBeGreaterThan(0);
    expect(result.invalid).toHaveLength(0);
    expect(result.snapshotFlagErrors).toHaveLength(0);
  });
});

// ─── Command Registry Consistency ──────────────────────────────

describe('Command registry consistency', () => {
  test('COMMAND_DESCRIPTIONS covers all base commands (READ + WRITE + META)', () => {
    const baseCmds = new Set([...READ_COMMANDS, ...WRITE_COMMANDS, ...META_COMMANDS]);
    const descKeys = new Set(Object.keys(COMMAND_DESCRIPTIONS));
    for (const cmd of baseCmds) {
      expect(descKeys.has(cmd)).toBe(true);
    }
  });

  test('COMMAND_DESCRIPTIONS has no extra commands not in any set', () => {
    for (const key of Object.keys(COMMAND_DESCRIPTIONS)) {
      expect(ALL_COMMANDS.has(key)).toBe(true);
    }
  });

  test('ALL_COMMANDS matches union of all command sets', () => {
    const union = new Set([
      ...READ_COMMANDS, ...WRITE_COMMANDS, ...META_COMMANDS,
      ...NS_COMMANDS, ...PLAYWRIGHT_COMMANDS,
    ]);
    expect(ALL_COMMANDS.size).toBe(union.size);
    for (const cmd of union) {
      expect(ALL_COMMANDS.has(cmd)).toBe(true);
    }
  });

  test('SNAPSHOT_FLAGS option keys are valid SnapshotOptions fields', () => {
    const validKeys = new Set([
      'interactive', 'compact', 'depth', 'selector',
      'diff', 'annotate', 'outputPath', 'cursorInteractive',
    ]);
    for (const flag of SNAPSHOT_FLAGS) {
      expect(validKeys.has(flag.optionKey)).toBe(true);
    }
  });
});

// ─── Usage String Consistency ──────────────────────────────────

describe('Usage string consistency', () => {
  function skeleton(usage: string): string {
    return usage
      .replace(/\(.*?\)/g, '')        // strip parenthetical hints
      .replace(/<[^>]*>/g, '<>')      // normalize <param-name> -> <>
      .replace(/\[[^\]]*\]/g, '[]')   // normalize [optional] -> []
      .replace(/\s+/g, ' ')           // collapse whitespace
      .trim();
  }

  test('implementation Usage: structural format matches COMMAND_DESCRIPTIONS', () => {
    const implFiles = [
      path.join(ROOT, 'browse', 'src', 'core', 'write-commands.ts'),
      path.join(ROOT, 'browse', 'src', 'core', 'read-commands.ts'),
      path.join(ROOT, 'browse', 'src', 'core', 'meta-commands.ts'),
    ];

    const usagePattern = /throw new Error\(['"`]Usage:\s*browse\s+(.+?)['"`]\)/g;
    const implUsages = new Map<string, string>();

    for (const file of implFiles) {
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf-8');
      let match;
      while ((match = usagePattern.exec(content)) !== null) {
        const usage = match[1].split('\\n')[0].trim();
        const cmd = usage.split(/\s/)[0];
        implUsages.set(cmd, usage);
      }
    }

    const mismatches: string[] = [];
    for (const [cmd, implUsage] of implUsages) {
      const desc = COMMAND_DESCRIPTIONS[cmd];
      if (!desc?.usage) continue;
      const descSkel = skeleton(desc.usage);
      const implSkel = skeleton(implUsage);
      if (descSkel !== implSkel) {
        mismatches.push(`${cmd}: docs "${desc.usage}" (${descSkel}) vs impl "${implUsage}" (${implSkel})`);
      }
    }

    expect(mismatches).toEqual([]);
  });
});

// ─── No Stale gstack References ────────────────────────────────

describe('No stale gstack references in steez skills', () => {
  // steez skills should not reference gstack paths or branding
  const ALLOWED_GSTACK_REFS = [
    /FORK_MANIFEST/,     // provenance doc is expected to mention gstack
    /forked from gstack/i,
    /upstream.*gstack/i,
  ];

  for (const skill of ALL_SKILLS) {
    test(`${skill.name}: no stale gstack references`, () => {
      const content = fs.readFileSync(skill.path, 'utf-8');
      const lines = content.split('\n');
      const violations: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/~\/\.gstack\/|gstack-config|gstack-slug|gstack-review-log|gstack-review-read/.test(line)) {
          // Check allowlist
          const isAllowed = ALLOWED_GSTACK_REFS.some(p => p.test(line));
          if (!isAllowed) {
            violations.push(`  line ${i + 1}: ${line.trim()}`);
          }
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `${skill.name}/SKILL.md has stale gstack references:\n${violations.join('\n')}`
        );
      }
    });
  }
});

// ─── Preamble Structure ────────────────────────────────────────

describe('Preamble structure', () => {
  // Skills that should have the steez preamble with session tracking
  for (const skill of ALL_SKILLS) {
    const content = fs.readFileSync(skill.path, 'utf-8');
    const hasPreamble = content.includes('STEEZ_HOME') || content.includes('_SESSION_ID');

    if (hasPreamble) {
      test(`${skill.name}: preamble sets STEEZ_HOME`, () => {
        expect(content).toContain('STEEZ_HOME');
      });

      test(`${skill.name}: preamble sets STEEZ_BIN`, () => {
        expect(content).toContain('STEEZ_BIN');
      });

      test(`${skill.name}: preamble contains escalation protocol`, () => {
        expect(content).toContain('DONE_WITH_CONCERNS');
        expect(content).toContain('BLOCKED');
        expect(content).toContain('NEEDS_CONTEXT');
      });
    }
  }
});

// ─── Cross-skill Path Consistency ──────────────────────────────

describe('Cross-skill path consistency', () => {
  test('REMOTE_SLUG derivation pattern is identical across skills that use it', () => {
    const skillsParent = path.dirname(ROOT);
    const subdirs = ['steez-qa', 'steez-review'].map(s => path.join(skillsParent, s));
    const allPatterns: string[] = [];

    for (const dir of subdirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (/^REMOTE_SLUG=\$\(.*\)$/.test(trimmed)) {
            allPatterns.push(trimmed);
          }
        }
      }
    }

    if (allPatterns.length >= 2) {
      const unique = new Set(allPatterns);
      if (unique.size > 1) {
        throw new Error(
          `REMOTE_SLUG pattern differs across files:\n` +
          Array.from(unique).map((v, i) => `  ${i + 1}: ${v}`).join('\n')
        );
      }
    }
  });
});

// ─── QA Skill Structure ────────────────────────────────────────

describe('QA skill structure validation', () => {
  const qaSkill = ALL_SKILLS.find(s => s.name === 'steez-qa');
  const qaContent = qaSkill ? fs.readFileSync(qaSkill.path, 'utf-8') : '';

  test('steez-qa skill exists', () => {
    expect(qaSkill).toBeDefined();
  });

  test('qa/SKILL.md has all 11 phases', () => {
    const phases = [
      'Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5',
      'Phase 6', 'Phase 7', 'Phase 8', 'Phase 9', 'Phase 10', 'Phase 11',
    ];
    for (const phase of phases) {
      expect(qaContent).toContain(phase);
    }
  });

  test('has all four QA modes defined', () => {
    for (const mode of ['Diff-aware', 'Full', 'Quick', 'Regression']) {
      expect(qaContent).toContain(mode);
    }
    expect(qaContent).toContain('--quick');
    expect(qaContent).toContain('--regression');
  });

  test('has all three tiers defined', () => {
    for (const tier of ['Quick', 'Standard', 'Exhaustive']) {
      expect(qaContent).toContain(tier);
    }
  });

  test('health score weights sum to 100%', () => {
    const weights = extractWeightsFromTable(qaContent);
    expect(weights.size).toBeGreaterThan(0);
    let sum = 0;
    for (const pct of weights.values()) sum += pct;
    expect(sum).toBe(100);
  });

  test('health score has all expected categories', () => {
    const weights = extractWeightsFromTable(qaContent);
    const expectedCategories = [
      'Console', 'Links', 'Visual', 'Functional',
      'UX', 'Performance', 'Content', 'Accessibility',
    ];
    for (const cat of expectedCategories) {
      expect(weights.has(cat)).toBe(true);
    }
    expect(weights.size).toBe(8);
  });

  test('output structure references report directory layout', () => {
    expect(qaContent).toContain('qa-report-');
    expect(qaContent).toContain('screenshots/');
  });
});

// ─── Review Skill Structure ────────────────────────────────────

describe('Review skill structure', () => {
  const reviewDir = path.join(path.dirname(ROOT), 'steez-review');

  test('checklist.md exists and has Enum & Value Completeness', () => {
    const checklistPath = path.join(reviewDir, 'checklist.md');
    expect(fs.existsSync(checklistPath)).toBe(true);
    const checklist = fs.readFileSync(checklistPath, 'utf-8');
    expect(checklist).toContain('Enum & Value Completeness');
  });

  test('TODOS-format.md exists and defines canonical format', () => {
    const todosPath = path.join(reviewDir, 'TODOS-format.md');
    expect(fs.existsSync(todosPath)).toBe(true);
    const content = fs.readFileSync(todosPath, 'utf-8');
    expect(content).toContain('**What:**');
    expect(content).toContain('**Why:**');
    expect(content).toContain('**Priority:**');
    expect(content).toContain('**Effort:**');
  });
});

// ─── Investigate Skill Structure ───────────────────────────────

describe('Investigate skill structure', () => {
  const skill = ALL_SKILLS.find(s => s.name === 'steez-investigate');
  const content = skill ? fs.readFileSync(skill.path, 'utf-8') : '';

  test('steez-investigate skill exists', () => {
    expect(skill).toBeDefined();
  });

  for (const section of ['Iron Law', 'Root Cause', 'Pattern Analysis', 'Hypothesis',
                          'DEBUG REPORT', '3-strike', 'BLOCKED']) {
    test(`contains ${section}`, () => expect(content).toContain(section));
  }
});

// ─── Office Hours Skill Structure ──────────────────────────────

describe('Office hours skill structure', () => {
  const skill = ALL_SKILLS.find(s => s.name === 'steez-office-hours');
  const content = skill ? fs.readFileSync(skill.path, 'utf-8') : '';

  test('steez-office-hours skill exists', () => {
    expect(skill).toBeDefined();
  });

  for (const section of ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5', 'Phase 6',
                          'Design Doc', 'Supersedes', 'APPROVED', 'Premise Challenge',
                          'Alternatives', 'Smart-skip']) {
    test(`contains ${section}`, () => expect(content).toContain(section));
  }

  // Dual-mode structure
  for (const section of ['Startup mode', 'Builder mode']) {
    test(`contains ${section}`, () => expect(content).toContain(section));
  }

  // Six forcing questions (startup mode)
  for (const question of ['Demand Reality', 'Status Quo', 'Desperate Specificity',
                           'Narrowest Wedge', 'Observation & Surprise', 'Future-Fit']) {
    test(`contains forcing question: ${question}`, () => expect(content).toContain(question));
  }
});

// ─── CEO Review Mode Validation ────────────────────────────────

describe('CEO review mode validation', () => {
  const skill = ALL_SKILLS.find(s => s.name === 'steez-plan-ceo-review');
  const content = skill ? fs.readFileSync(skill.path, 'utf-8') : '';

  test('steez-plan-ceo-review skill exists', () => {
    expect(skill).toBeDefined();
  });

  test('has all four CEO review modes', () => {
    for (const mode of ['SCOPE EXPANSION', 'SELECTIVE EXPANSION', 'HOLD SCOPE', 'SCOPE REDUCTION']) {
      expect(content).toContain(mode);
    }
  });

  test('has CEO plan persistence step', () => {
    expect(content).toContain('ceo-plans');
    expect(content).toContain('status: ACTIVE');
  });

  test('contains prerequisite skill offer for office-hours', () => {
    expect(content).toContain('Prerequisite Skill Offer');
    expect(content).toContain('/steez-office-hours');
  });
});

// ─── steez-slug Helper ─────────────────────────────────────────

describe('steez-slug', () => {
  const SLUG_BIN = path.join(ROOT, 'bin', 'steez-slug');

  test('binary exists and is executable', () => {
    expect(fs.existsSync(SLUG_BIN)).toBe(true);
    const stat = fs.statSync(SLUG_BIN);
    expect(stat.mode & 0o111).toBeGreaterThan(0);
  });

  test('outputs SLUG and BRANCH lines in a git repo', () => {
    const result = Bun.spawnSync([SLUG_BIN], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' });
    expect(result.exitCode).toBe(0);
    const output = result.stdout.toString();
    expect(output).toContain('SLUG=');
    expect(output).toContain('BRANCH=');
  });

  test('SLUG does not contain forward slashes', () => {
    const result = Bun.spawnSync([SLUG_BIN], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' });
    const slug = result.stdout.toString().match(/SLUG=(.*)/)?.[1] ?? '';
    expect(slug).not.toContain('/');
    expect(slug.length).toBeGreaterThan(0);
  });

  test('output values contain only safe characters', () => {
    const result = Bun.spawnSync([SLUG_BIN], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' });
    const slug = result.stdout.toString().match(/SLUG=(.*)/)?.[1] ?? '';
    const branch = result.stdout.toString().match(/BRANCH=(.*)/)?.[1] ?? '';
    expect(slug).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect(branch).toMatch(/^[a-zA-Z0-9._-]+$/);
  });

  test('output is eval-compatible (KEY=VALUE format)', () => {
    const result = Bun.spawnSync([SLUG_BIN], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' });
    const lines = result.stdout.toString().trim().split('\n');
    expect(lines.length).toBe(2);
    expect(lines[0]).toMatch(/^SLUG=.+/);
    expect(lines[1]).toMatch(/^BRANCH=.+/);
  });
});

// ─── Skill Discovery Sanity ────────────────────────────────────

describe('Skill discovery sanity', () => {
  test('discovers at least 15 steez skills', () => {
    // steez has 21 skills as of the fork — this is a floor, not exact count
    expect(ALL_SKILLS.length).toBeGreaterThanOrEqual(15);
  });

  test('all discovered skills have valid SKILL.md files', () => {
    for (const skill of ALL_SKILLS) {
      const content = fs.readFileSync(skill.path, 'utf-8');
      expect(content.length).toBeGreaterThan(100);
      // Every SKILL.md should have frontmatter (--- delimiters)
      expect(content.startsWith('---')).toBe(true);
    }
  });

  test('every steez skill name starts with steez-', () => {
    for (const skill of ALL_SKILLS) {
      expect(skill.name.startsWith('steez-')).toBe(true);
    }
  });
});

// ─── QA Report Template ────────────────────────────────────────

describe('QA report template', () => {
  const templatePath = path.join(path.dirname(ROOT), 'steez-qa', 'templates', 'qa-report-template.md');

  test('qa-report-template.md exists', () => {
    expect(fs.existsSync(templatePath)).toBe(true);
  });

  test('has Regression Tests section', () => {
    expect(fs.existsSync(templatePath)).toBe(true);
    const content = fs.readFileSync(templatePath, 'utf-8');
    expect(content).toContain('## Regression Tests');
  });
});

// ─── No Hardcoded Branch Names ─────────────────────────────────

describe('No hardcoded branch names in skills', () => {
  const gitMainPatterns = [
    /\bgit\s+diff\s+(?:origin\/)?main\b/,
    /\bgit\s+log\s+(?:origin\/)?main\b/,
    /\bgit\s+fetch\s+origin\s+main\b/,
    /\bgit\s+merge\s+origin\/main\b/,
  ];

  const allowlist = [
    /fall\s*back\s+to\s+`?main`?/i,
    /typically\s+`?main`?/i,
    /default.*branch.*main/i,
    /main.*branch/i,
  ];

  // Check key workflow skills that interact with git
  const gitSkills = ['steez-ship', 'steez-review', 'steez-retro'].map(name =>
    ALL_SKILLS.find(s => s.name === name)
  ).filter(Boolean) as Array<{ name: string; path: string }>;

  for (const skill of gitSkills) {
    test(`${skill.name}: no hardcoded 'main' in git commands`, () => {
      const lines = fs.readFileSync(skill.path, 'utf-8').split('\n');
      const violations: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isAllowlisted = allowlist.some(p => p.test(line));
        if (isAllowlisted) continue;

        for (const pattern of gitMainPatterns) {
          if (pattern.test(line)) {
            violations.push(`Line ${i + 1}: ${line.trim()}`);
            break;
          }
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `${skill.name}/SKILL.md has hardcoded 'main' in git commands:\n` +
          violations.map(v => `  ${v}`).join('\n')
        );
      }
    });
  }
});
