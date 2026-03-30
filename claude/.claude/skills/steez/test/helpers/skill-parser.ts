/**
 * SKILL.md parser and validator for steez skills.
 *
 * Extracts $B commands from code blocks, validates them against
 * the command registry and snapshot flags.
 *
 * Ported from gstack/test/helpers/skill-parser.ts, adapted for steez's
 * file layout (browse/src/core/ instead of browse/src/).
 */

import { ALL_COMMANDS } from '../../browse/src/core/commands';
import { parseSnapshotArgs } from '../../browse/src/core/snapshot';
import * as fs from 'fs';
import * as path from 'path';

export interface BrowseCommand {
  command: string;
  args: string[];
  line: number;
  raw: string;
}

export interface ValidationResult {
  valid: BrowseCommand[];
  invalid: BrowseCommand[];
  snapshotFlagErrors: Array<{ command: BrowseCommand; error: string }>;
  warnings: string[];
}

/**
 * Extract all $B invocations from bash code blocks in a SKILL.md file.
 */
export function extractBrowseCommands(skillPath: string): BrowseCommand[] {
  const content = fs.readFileSync(skillPath, 'utf-8');
  const lines = content.split('\n');
  const commands: BrowseCommand[] = [];

  let inBashBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect code block boundaries
    if (line.trimStart().startsWith('```')) {
      if (inBashBlock) {
        inBashBlock = false;
      } else if (line.trimStart().startsWith('```bash')) {
        inBashBlock = true;
      }
      // Non-bash code blocks (```json, ```, ```js, etc.) are skipped
      continue;
    }

    if (!inBashBlock) continue;

    // Match lines with $B command invocations
    // Handle multiple $B commands on one line (e.g., "$B click @e3       $B fill @e4 "value"")
    const matches = line.matchAll(/\$B\s+(\S+)(?:\s+([^\$]*))?/g);
    for (const match of matches) {
      const command = match[1];
      let argsStr = (match[2] || '').trim();

      // Strip inline comments (# ...) — but not inside quotes
      let inQuote = false;
      for (let j = 0; j < argsStr.length; j++) {
        if (argsStr[j] === '"') inQuote = !inQuote;
        if (argsStr[j] === '#' && !inQuote) {
          argsStr = argsStr.slice(0, j).trim();
          break;
        }
      }

      // Parse args — handle quoted strings
      const args: string[] = [];
      if (argsStr) {
        const argMatches = argsStr.matchAll(/"([^"]*)"|(\S+)/g);
        for (const am of argMatches) {
          args.push(am[1] ?? am[2]);
        }
      }

      commands.push({
        command,
        args,
        line: i + 1, // 1-based
        raw: match[0].trim(),
      });
    }
  }

  return commands;
}

/**
 * Extract and validate all $B commands in a SKILL.md file.
 */
export function validateSkill(skillPath: string): ValidationResult {
  const commands = extractBrowseCommands(skillPath);
  const result: ValidationResult = {
    valid: [],
    invalid: [],
    snapshotFlagErrors: [],
    warnings: [],
  };

  if (commands.length === 0) {
    result.warnings.push('no $B commands found');
    return result;
  }

  for (const cmd of commands) {
    if (!ALL_COMMANDS.has(cmd.command)) {
      result.invalid.push(cmd);
      continue;
    }

    // Validate snapshot flags
    if (cmd.command === 'snapshot' && cmd.args.length > 0) {
      try {
        parseSnapshotArgs(cmd.args);
      } catch (err: any) {
        result.snapshotFlagErrors.push({ command: cmd, error: err.message });
        continue;
      }
    }

    result.valid.push(cmd);
  }

  return result;
}

/**
 * Extract all REMOTE_SLUG=$(...) assignment patterns from .md files in given subdirectories.
 * Returns a Map from filename -> array of full assignment lines found.
 */
export function extractRemoteSlugPatterns(rootDir: string, subdirs: string[]): Map<string, string[]> {
  const results = new Map<string, string[]>();
  const pattern = /^REMOTE_SLUG=\$\(.*\)$/;

  for (const subdir of subdirs) {
    const dir = path.join(rootDir, subdir);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const matches: string[] = [];

      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (pattern.test(trimmed)) {
          matches.push(trimmed);
        }
      }

      if (matches.length > 0) {
        results.set(`${subdir}/${file}`, matches);
      }
    }
  }

  return results;
}

/**
 * Parse a markdown weight table anchored to a "### Weights" heading.
 * Expects rows like: | Category | 15% |
 * Returns Map<category, number> where number is the percentage (e.g., 15).
 */
export function extractWeightsFromTable(content: string): Map<string, number> {
  const weights = new Map<string, number>();

  // Find the ### Weights section
  const weightsIdx = content.indexOf('### Weights');
  if (weightsIdx === -1) return weights;

  // Find the table within that section (stop at next heading or end)
  const section = content.slice(weightsIdx);
  const lines = section.split('\n');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();

    // Stop at next heading
    if (line.startsWith('#') && !line.startsWith('###')) break;
    if (line.startsWith('### ') && i > 0) break;

    // Parse table rows: | Category | N% |
    const match = line.match(/^\|\s*(\w[\w\s]*\w|\w+)\s*\|\s*(\d+)%\s*\|$/);
    if (match) {
      const category = match[1].trim();
      const pct = parseInt(match[2], 10);
      // Skip header row
      if (category !== 'Category' && !isNaN(pct)) {
        weights.set(category, pct);
      }
    }
  }

  return weights;
}

/**
 * Discover all steez skill SKILL.md files.
 * Looks for steez-{name}/SKILL.md as siblings of the steez/ root directory.
 */
export function discoverSkillFiles(steezRoot: string): Array<{ name: string; path: string }> {
  const skillsParentDir = path.dirname(steezRoot);
  const skills: Array<{ name: string; path: string }> = [];

  for (const entry of fs.readdirSync(skillsParentDir, { withFileTypes: true })) {
    if (!entry.name.startsWith('steez-')) continue;
    // Skill dirs may be symlinks (stow folding), so check both
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const skillMd = path.join(skillsParentDir, entry.name, 'SKILL.md');
    if (fs.existsSync(skillMd)) {
      skills.push({ name: entry.name, path: skillMd });
    }
  }

  return skills;
}
