# TUI Infrastructure Overhaul - Implementation Plan

**Created**: 2025-12-28
**Status**: Planning
**Estimated Total Effort**: 5-7 days
**Priority**: High - Critical for CI/automation reliability

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Dependencies](#3-dependencies)
4. [Implementation Phases](#4-implementation-phases)
5. [Phase 1: Foundation (cli-output.ts)](#5-phase-1-foundation-cli-outputts)
6. [Phase 2: Progress System](#6-phase-2-progress-system)
7. [Phase 3: Table Rendering](#7-phase-3-table-rendering)
8. [Phase 4: CI/Automation Support](#8-phase-4-ciautomation-support)
9. [Phase 5: Error Handling & Cancellation](#9-phase-5-error-handling--cancellation)
10. [Phase 6: Modularization](#10-phase-6-modularization)
11. [Phase 7: Polish & Accessibility](#11-phase-7-polish--accessibility)
12. [Phase 8: Advanced Features](#12-phase-8-advanced-features)
13. [Migration Strategy](#13-migration-strategy)
14. [Testing Strategy](#14-testing-strategy)
15. [Risk Assessment](#15-risk-assessment)
16. [Success Criteria](#16-success-criteria)
17. [Appendix: Code Templates](#17-appendix-code-templates)

---

## 1. Executive Summary

### Goals

1. **Reliability**: Ensure test bench works in CI/non-TTY environments
2. **Consistency**: Unified output formatting across all test scripts
3. **Visibility**: Rich progress indication with ETA, throughput, phase awareness
4. **Accessibility**: Support NO_COLOR, screen readers, narrow terminals
5. **Maintainability**: Modular architecture, single source of truth for UI

### Key Deliverables

- New `src/utils/cli-output.ts` module (centralized output)
- New `src/utils/cli-progress.ts` module (progress rendering)
- New `src/utils/cli-table.ts` module (table rendering)
- Updated test-bench.ts, test-ab-runner.ts, test-cli-benchmark.ts
- New CLI flags: --json, --quiet, --verbose, --no-color, --ascii
- Graceful cancellation with partial report saving

### Non-Goals (Out of Scope)

- Changing test case definitions or evaluation logic
- Modifying the Raycast extension UI (only CLI tools)
- Changing the statistical analysis algorithms
- Adding new test commands (only improving existing)

---

## 2. Current State Analysis

### 2.1 Files Inventory

| File                               | Lines | Output Calls | Complexity | Changes Needed  |
| ---------------------------------- | ----- | ------------ | ---------- | --------------- |
| `src/test-bench.ts`                | 1,698 | 89           | High       | Major refactor  |
| `src/test-ab-runner.ts`            | 944   | 98           | High       | Major refactor  |
| `src/test-cli-benchmark.ts`        | 194   | 24           | Low        | Moderate update |
| `src/test-engines.ts`              | ~50   | 14           | Low        | Minor update    |
| `src/test-smart-quality.ts`        | ~200  | 26           | Low        | Minor update    |
| `src/test-judge-comparison.ts`     | ~250  | 28           | Medium     | Moderate update |
| `src/test-evaluator-comparison.ts` | ~220  | 16           | Low        | Minor update    |
| `src/test-context-preservation.ts` | ~240  | 18           | Low        | Minor update    |
| `src/test-model-comparison.ts`     | ~270  | 22           | Medium     | Moderate update |
| `src/utils/format.ts`              | 71    | 0            | Low        | No changes      |
| `src/utils/statistics.ts`          | 501   | 0            | Low        | No changes      |
| `src/utils/evaluator.ts`           | 331   | 0            | Low        | No changes      |

**Total**: 299 output calls to migrate

### 2.2 Current Output Patterns

#### Pattern 1: Headers/Sections

```typescript
// test-bench.ts:120, 130, 152, etc.
console.log("=".repeat(60));
console.log("CLI BENCHMARK: Native vs OpenCode");
console.log("=".repeat(60));

// test-ab-runner.ts:856-858
console.log("\n" + "=".repeat(50));
console.log("SUMMARY");
console.log("=".repeat(50));
```

#### Pattern 2: Status Messages

```typescript
// test-bench.ts:447, 450, 455
console.log(`  ${color.green("V")} ${testCase.id}`);
console.log(`  ${color.red("X")} ${testCase.id} - Missing required tags`);

// test-ab-runner.ts:702, 711
console.log(`  [OK] Baseline: ${baseline.id} - ${baseline.name}`);
console.log(`  [OK] Candidate: ${candidate.id} - ${candidate.name}`);
```

#### Pattern 3: Progress Updates

```typescript
// test-ab-runner.ts:779
process.stdout.write(`\r  Progress: ${completed}/${total}`);

// test-cli-benchmark.ts:94
process.stdout.write(`  ${name} run ${i + 1}/${RUNS_PER_TEST}...`);
```

#### Pattern 4: Tables

```typescript
// test-bench.ts:278-286 (formatTable function)
// test-cli-benchmark.ts:156-163 (manual table)
console.log("| Test             | Avg (ms) | Min (ms) | Max (ms) |");
console.log("|------------------|----------|----------|----------|");
```

#### Pattern 5: Metrics/Statistics

```typescript
// test-ab-runner.ts:868-875
console.log(`Baseline (${baseline.id}):  avg score = ${report.summary.baselineAvgScore.toFixed(2)}`);
console.log(`p-value: ${report.summary.pValue.toFixed(4)}`);
console.log(`Significant: ${report.summary.significant ? "YES" : "NO"}`);
```

### 2.3 Current Symbol/Emoji Usage (Inconsistent)

| Symbol      | Meaning    | Files Using                        | Inconsistencies                |
| ----------- | ---------- | ---------------------------------- | ------------------------------ |
| Checkmark   | Success    | test-bench.ts                      | Sometimes green, sometimes not |
| X mark      | Failure    | test-bench.ts                      | Sometimes red, sometimes not   |
| Check emoji | Success    | test-ab-runner.ts, test-engines.ts | Different from checkmark       |
| X emoji     | Failure    | test-ab-runner.ts                  | Different from X mark          |
| Arrow       | Processing | test-bench.ts                      | Green colored                  |
| Triangle    | Running    | None currently                     | Could add                      |
| Warning     | Warning    | test-ab-runner.ts                  | Emoji vs symbol                |
| Package     | Loading    | test-ab-runner.ts                  | Emoji                          |
| Chart       | Statistics | test-ab-runner.ts                  | Emoji                          |
| Rocket      | Starting   | test-ab-runner.ts                  | Emoji                          |
| Money       | Cost       | test-ab-runner.ts                  | Emoji                          |

### 2.4 Current CLI Arguments

#### test-bench.ts

```typescript
// Lines ~1000-1100 (parseArgs function)
--strategy <id>       // Strategy to test
--engine <name>       // Engine to use (gemini, codex)
--model <name>        // Model to use
--mode <quick|detailed>
--judge <id>          // Judge configuration
--concurrency <n>     // Parallel execution limit
--case <id>           // Single test case
--category <name>     // Filter by category
--force               // Skip cache
--dry-run             // Show what would run
// MISSING: --json, --quiet, --verbose, --no-color, --ascii
```

#### test-ab-runner.ts

```typescript
// Lines ~650-700 (argument parsing)
--baseline<path>; // Baseline strategy file
--candidate<path>; // Candidate strategy file
--mode<quick | detailed>;
--category<name>; // Filter by category
--judge<id>; // Judge configuration
--concurrency<n>; // Parallel execution limit
--dry - run; // Show cost estimate
// MISSING: --json, --quiet, --verbose, --no-color, --ascii
```

---

## 3. Dependencies

### 3.1 New Dependencies to Add

```bash
npm install --save-dev cli-table3
```

**Package Details**:

- `cli-table3@0.6.5` - Table rendering with Unicode borders, colors, column widths
- Size: ~20 kB
- Weekly downloads: ~10M
- Last updated: May 2024
- TypeScript types: Included

**Why cli-table3**:

- Handles ANSI color codes correctly (uses string-width internally)
- Supports column width constraints and word wrapping
- Active maintenance
- Much smaller than alternatives

### 3.2 Optional Dependencies (Phase 8)

```bash
# Only if implementing advanced task visualization
npm install --save-dev listr2
```

**Package Details**:

- `listr2@8.x` - Task list with concurrent progress
- Size: ~50 kB
- Use case: Rich parallel task visualization
- Decision: Evaluate after Phase 7

### 3.3 Dependencies to Keep

- `@clack/prompts@0.11.0` - Keep for interactive mode
- `picocolors@1.1.1` - Keep for colors (14x smaller than chalk)

### 3.4 No Dependencies to Remove

Current dependencies are minimal and appropriate.

---

## 4. Implementation Phases

### Phase Dependency Graph

```
Phase 1 (Foundation)
    |
    +---> Phase 2 (Progress)
    |        |
    +---> Phase 3 (Tables)
    |        |
    +---> Phase 4 (CI/JSON) <--+
              |
              v
         Phase 5 (Errors/Cancel)
              |
              v
         Phase 6 (Modularization)
              |
              v
         Phase 7 (Polish)
              |
              v
         Phase 8 (Advanced) [Optional]
```

### Phase Summary

| Phase | Name                          | Effort   | Dependencies  | Risk   |
| ----- | ----------------------------- | -------- | ------------- | ------ |
| 1     | Foundation (cli-output.ts)    | 4-6 hrs  | None          | Low    |
| 2     | Progress System               | 4-6 hrs  | Phase 1       | Medium |
| 3     | Table Rendering               | 2-4 hrs  | Phase 1       | Low    |
| 4     | CI/Automation Support         | 4-6 hrs  | Phase 1, 2, 3 | Medium |
| 5     | Error Handling & Cancellation | 4-6 hrs  | Phase 4       | Medium |
| 6     | Modularization                | 6-10 hrs | Phase 5       | High   |
| 7     | Polish & Accessibility        | 3-4 hrs  | Phase 6       | Low    |
| 8     | Advanced Features             | 4-8 hrs  | Phase 7       | Medium |

**Total Estimate**: 31-50 hours (5-7 working days)

---

## 5. Phase 1: Foundation (cli-output.ts)

### 5.1 Overview

Create centralized output module that all test scripts will use.

**Deliverables**:

- `src/utils/cli-output.ts` - Main output module
- `src/utils/cli-types.ts` - Shared types for CLI

### 5.2 New File: `src/utils/cli-types.ts`

**Location**: `src/utils/cli-types.ts`
**Lines**: ~100

```typescript
/**
 * CLI Types - Shared type definitions for CLI output system
 */

// --- Environment Detection ---

export interface CliEnvironment {
  /** Whether stdout is a TTY (terminal) */
  isTTY: boolean;
  /** Whether running in CI environment */
  isCI: boolean;
  /** Whether colors are disabled (NO_COLOR env) */
  noColor: boolean;
  /** Whether to force colors (FORCE_COLOR env) */
  forceColor: boolean;
  /** Terminal width in columns */
  columns: number;
  /** Whether Unicode is supported */
  supportsUnicode: boolean;
}

// --- Output Modes ---

export type OutputMode = "normal" | "quiet" | "verbose" | "json";

export interface OutputOptions {
  mode: OutputMode;
  noColor: boolean;
  ascii: boolean;
}

// --- Symbols ---

export interface SymbolSet {
  ok: string;
  fail: string;
  warn: string;
  info: string;
  arrow: string;
  running: string;
  pending: string;
  skip: string;
  bullet: string;
  dash: string;
  ellipsis: string;
}

// --- Log Levels ---

export type LogLevel = "debug" | "info" | "success" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

// --- Progress ---

export interface ProgressState {
  current: number;
  total: number;
  phase: string;
  startTime: number;
  cacheHits: number;
  cacheMisses: number;
  retries: number;
  errors: number;
  lastUpdate: number;
}

export interface ProgressOptions {
  /** Minimum ms between updates (default: 100) */
  throttleMs?: number;
  /** Show ETA (default: true) */
  showEta?: boolean;
  /** Show throughput (default: true) */
  showThroughput?: boolean;
  /** Show cache stats (default: true) */
  showCacheStats?: boolean;
  /** Width of progress bar (default: 20) */
  barWidth?: number;
}

// --- Tables ---

export interface TableOptions {
  /** Column headers */
  headers: string[];
  /** Column alignments */
  align?: ("left" | "center" | "right")[];
  /** Column max widths (0 = no limit) */
  maxWidths?: number[];
  /** Whether to show borders */
  borders?: boolean;
  /** Whether to colorize header */
  colorHeader?: boolean;
}

// --- Failures ---

export interface FailureRecord {
  testCaseId: string;
  phase: "optimize" | "judge" | "validate";
  error: string;
  timestamp: Date;
  rerunCommand?: string;
}

// --- CLI Arguments (common across scripts) ---

export interface CommonCliArgs {
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  noColor?: boolean;
  ascii?: boolean;
}
```

### 5.3 New File: `src/utils/cli-output.ts`

**Location**: `src/utils/cli-output.ts`
**Lines**: ~550

This file will contain:

1. **Environment Detection** (~50 lines)
   - `detectEnvironment()` - Detect TTY, CI, NO_COLOR, terminal width
   - `env` - Cached environment object

2. **Output Options** (~40 lines)
   - `configureOutput()` - Set output mode from CLI args
   - `getOutputOptions()` - Get current options
   - `colorsEnabled()` - Check if colors are enabled
   - `isJsonMode()` / `isQuietMode()` / `isVerboseMode()`

3. **Symbols** (~60 lines)
   - `UNICODE_SYMBOLS` - Unicode symbol set
   - `ASCII_SYMBOLS` - ASCII fallback set
   - `symbols` - Getter object with colored symbols

4. **Text Utilities** (~50 lines)
   - `visibleLength()` - Get visible length (strip ANSI)
   - `truncate()` - Truncate with ellipsis
   - `padEnd()` / `padStart()` - Pad to visible length
   - `getTerminalWidth()` - Get terminal width

5. **Color Wrappers** (~30 lines)
   - `c.bold()`, `c.dim()`, `c.green()`, etc. - Color wrappers that respect noColor

6. **Logging** (~80 lines)
   - `log.debug()`, `log.info()`, `log.success()`, `log.warn()`, `log.error()`
   - `log.plain()`, `log.blank()`
   - Log buffer for JSON mode

7. **Headers & Sections** (~60 lines)
   - `header()` - Major section header (double line)
   - `subheader()` - Sub-section header (single line)
   - `divider()` - Divider line
   - `labeledHeader()` - Header with background color

8. **Status Output** (~40 lines)
   - `testResult()` - Print test result line
   - `testRunning()` - Print running line
   - `testSkipped()` - Print skipped line

9. **Key-Value Output** (~30 lines)
   - `keyValue()` - Print labeled value
   - `keyValueInline()` - Print multiple key-values inline

10. **Failure Collection** (~40 lines)
    - `recordFailure()` - Record a failure
    - `getFailures()` - Get all failures
    - `printFailureSummary()` - Print summary at end

11. **JSON Output** (~20 lines)
    - `outputJson()` - Output final JSON to stdout

12. **Formatting Helpers** (~50 lines)
    - `formatDuration()` - Format ms to human readable
    - `formatBytes()` - Format bytes to human readable
    - `formatPercent()` - Format percentage
    - `formatDelta()` - Format change with color and sign
    - `formatScoreDelta()` - Format score delta (higher is better)

### 5.4 Verification Steps

1. **Unit test the module**:

   ```bash
   npx ts-node -e "
   import { symbols, log, header, c, formatDuration, visibleLength } from './src/utils/cli-output';

   console.log('Symbols:', symbols.ok, symbols.fail, symbols.warn);
   header('TEST HEADER');
   log.info('Info message');
   log.success('Success message');
   log.warn('Warning message');
   log.error('Error message');
   console.log('Duration:', formatDuration(12345));
   console.log('Visible length of colored:', visibleLength(c.green('test')));
   "
   ```

2. **Test environment detection**:

   ```bash
   # Test NO_COLOR
   NO_COLOR=1 npx ts-node -e "
   import { colorsEnabled } from './src/utils/cli-output';
   console.log('Colors enabled:', colorsEnabled());
   "

   # Test CI detection
   CI=true npx ts-node -e "
   import { env } from './src/utils/cli-output';
   console.log('Is CI:', env.isCI);
   "
   ```

3. **Lint and type check**:
   ```bash
   npm run lint
   npx tsc --noEmit
   ```

### 5.5 Files Changed

| File                      | Action    | Changes                 |
| ------------------------- | --------- | ----------------------- |
| `src/utils/cli-types.ts`  | CREATE    | New file (~100 lines)   |
| `src/utils/cli-output.ts` | CREATE    | New file (~550 lines)   |
| `package.json`            | NO CHANGE | No new deps for Phase 1 |

---

## 6. Phase 2: Progress System

### 6.1 Overview

Create progress rendering system with ETA, throughput, and phase awareness.

**Deliverables**:

- `src/utils/cli-progress.ts` - Progress rendering module

### 6.2 New File: `src/utils/cli-progress.ts`

**Location**: `src/utils/cli-progress.ts`
**Lines**: ~320

This file will contain:

1. **Constants** (~10 lines)
   - Default options for progress rendering

2. **Progress Bar Renderer** (~40 lines)
   - `renderBar()` - Render progress bar string
   - `calculateEta()` - Calculate estimated time remaining
   - `calculateThroughput()` - Calculate items per minute

3. **ProgressManager Class** (~150 lines)
   - Constructor with total and phase
   - `start()` - Begin progress tracking
   - `increment()` - Update progress with optional cache/retry info
   - `setPhase()` - Update phase label
   - `finish()` - Complete and clear progress line
   - `getState()` - Get current state for JSON
   - Private `render()` - Render progress line to stderr

4. **Simple Progress Functions** (~40 lines)
   - `startProgress()` - Start simple progress
   - `incrementProgress()` - Increment
   - `setProgressPhase()` - Update phase
   - `finishProgress()` - Finish

5. **Spinner Class** (~80 lines)
   - Constructor with message
   - `start()` - Begin spinner animation
   - `update()` - Update message
   - `stop()` - Stop and optionally print final message

### 6.3 Key Implementation Details

**Progress Bar Format**:

```
Optimizing... [========--------] 8/20 (40%) | ETA: 2m 15s | 2.3/min | Cache: 72%
```

**Throttling**: Max 10 updates per second (100ms minimum between renders)

**Non-TTY Behavior**: In CI/non-TTY, progress is disabled (no output)

### 6.4 Files Changed

| File                        | Action | Changes               |
| --------------------------- | ------ | --------------------- |
| `src/utils/cli-progress.ts` | CREATE | New file (~320 lines) |

---

## 7. Phase 3: Table Rendering

### 7.1 Overview

Replace custom `formatTable()` with proper table rendering using `cli-table3`.

### 7.2 Install Dependency

```bash
npm install --save-dev cli-table3
```

### 7.3 New File: `src/utils/cli-table.ts`

**Location**: `src/utils/cli-table.ts`
**Lines**: ~280

This file will contain:

1. **Border Characters** (~40 lines)
   - `getBorderChars()` - Unicode or ASCII borders
   - `getMinimalBorderChars()` - No top/bottom lines

2. **Table Builder** (~80 lines)
   - `createTable()` - Create table with project defaults
   - `printTable()` - Render and print to stderr

3. **Pre-built Table Types** (~80 lines)
   - `createResultsTable()` - Test results table
   - `createComparisonTable()` - A/B comparison table
   - `createStatsTable()` - Statistics summary table
   - `createCacheTable()` - Cache status table
   - `createBenchmarkTable()` - Benchmark results table

4. **Helper Functions** (~80 lines)
   - `addRow()` - Add row with truncation
   - `addStatusRow()` - Add colored status row
   - `addComparisonRow()` - Add comparison row with delta coloring

### 7.4 Migration: Remove Old formatTable()

**File**: `src/test-bench.ts`
**Lines to remove**: ~278-286

**Replace usages** (search for `formatTable(`):

- Line ~714: Cache status table
- Line ~809: Compare results table

### 7.5 Files Changed

| File                     | Action | Changes                             |
| ------------------------ | ------ | ----------------------------------- |
| `package.json`           | MODIFY | Add cli-table3 dependency           |
| `src/utils/cli-table.ts` | CREATE | New file (~280 lines)               |
| `src/test-bench.ts`      | MODIFY | Remove formatTable(), update usages |

---

## 8. Phase 4: CI/Automation Support

### 8.1 Overview

Add `--json`, `--quiet`, `--verbose`, `--no-color`, `--ascii` flags.

### 8.2 New File: `src/utils/cli-args.ts`

**Location**: `src/utils/cli-args.ts`
**Lines**: ~130

This file will contain:

1. **Argument Parsing** (~50 lines)
   - `parseCommonArgs()` - Parse common CLI args from argv
   - `applyCommonArgs()` - Apply to output configuration
   - `initCliOutput()` - Convenience function

2. **Help Text** (~20 lines)
   - `getCommonArgsHelp()` - Get help text for common args
   - `isHelpRequested()` - Check for --help flag

3. **Validation** (~20 lines)
   - `validateArgs()` - Validate mutually exclusive args

4. **Non-Interactive Mode** (~40 lines)
   - `isNonInteractive()` - Check if in CI/piped mode
   - `requireInteractive()` - Exit with error if non-interactive

### 8.3 Integration Pattern

Update `test-bench.ts` and `test-ab-runner.ts` main() functions to:

1. Call `initCliOutput()` first
2. Validate args with `validateArgs()`
3. Check `isNonInteractive()` before interactive prompts
4. Call `outputJson()` at end if in JSON mode

### 8.4 Files Changed

| File                        | Action | Changes               |
| --------------------------- | ------ | --------------------- |
| `src/utils/cli-args.ts`     | CREATE | New file (~130 lines) |
| `src/test-bench.ts`         | MODIFY | Integrate cli-args    |
| `src/test-ab-runner.ts`     | MODIFY | Integrate cli-args    |
| `src/test-cli-benchmark.ts` | MODIFY | Integrate cli-args    |

---

## 9. Phase 5: Error Handling & Cancellation

### 9.1 Overview

Implement graceful cancellation and deferred failure reporting.

### 9.2 New File: `src/utils/cli-cancel.ts`

**Location**: `src/utils/cli-cancel.ts`
**Lines**: ~200

This file will contain:

1. **Cancellation State** (~30 lines)
   - `wasCancelled()` - Check if cancelled
   - `onCancel()` - Register cancel callback
   - `onCleanup()` - Register cleanup callback
   - `resetCancelHandlers()` - Clear all callbacks

2. **Signal Handling** (~50 lines)
   - `installCancelHandler()` - Install SIGINT/SIGTERM handlers
   - Handle double Ctrl-C for force exit

3. **Cancellation Summary** (~50 lines)
   - `setPartialResults()` - Set partial results for summary
   - `printCancellationSummary()` - Print summary on cancel

4. **Cancellation-Aware Helpers** (~70 lines)
   - `withCancellation()` - Run function with cancel check
   - `runUnlessCancelled()` - Run or skip if cancelled
   - `allWithCancellation()` - Promise.all with cancellation

### 9.3 Integration Pattern

In test-ab-runner.ts:

1. Call `installCancelHandler()` at start
2. Register cleanup to save partial results
3. Check `wasCancelled()` in main loop
4. Skip remaining work if cancelled

### 9.4 Files Changed

| File                      | Action | Changes                |
| ------------------------- | ------ | ---------------------- |
| `src/utils/cli-cancel.ts` | CREATE | New file (~200 lines)  |
| `src/test-bench.ts`       | MODIFY | Integrate cancellation |
| `src/test-ab-runner.ts`   | MODIFY | Integrate cancellation |

---

## 10. Phase 6: Modularization

### 10.1 Overview

Split `test-bench.ts` (1,698 lines) into manageable modules.

### 10.2 Target Structure

```
src/
  bench/
    index.ts          # Main entry, CLI routing (~80 lines)
    args.ts           # Argument parsing (~150 lines)
    interactive.ts    # @clack/prompts interactive mode (~200 lines)
    commands/
      validate.ts     # validate command (~80 lines)
      optimize.ts     # optimize command (~150 lines)
      judge.ts        # judge command (~150 lines)
      cache.ts        # cache command (~100 lines)
      compare.ts      # compare command (~100 lines)
      ab.ts           # ab command (~200 lines)
  test-bench.ts       # Thin wrapper (~15 lines)
```

### 10.3 Extraction Plan

1. **Extract args.ts** - `parseArgs()` function and types
2. **Extract interactive.ts** - All @clack/prompts usage
3. **Extract commands one by one** - Each command becomes a separate file
4. **Create index.ts** - Main routing logic
5. **Update test-bench.ts** - Thin wrapper

### 10.4 Files Changed

| File                             | Action  | Changes                       |
| -------------------------------- | ------- | ----------------------------- |
| `src/bench/index.ts`             | CREATE  | Main routing (~80 lines)      |
| `src/bench/args.ts`              | CREATE  | Argument parsing (~150 lines) |
| `src/bench/interactive.ts`       | CREATE  | Interactive mode (~200 lines) |
| `src/bench/commands/validate.ts` | CREATE  | Validate command (~80 lines)  |
| `src/bench/commands/optimize.ts` | CREATE  | Optimize command (~150 lines) |
| `src/bench/commands/judge.ts`    | CREATE  | Judge command (~150 lines)    |
| `src/bench/commands/cache.ts`    | CREATE  | Cache commands (~100 lines)   |
| `src/bench/commands/compare.ts`  | CREATE  | Compare command (~100 lines)  |
| `src/bench/commands/ab.ts`       | CREATE  | A/B command (~200 lines)      |
| `src/test-bench.ts`              | REPLACE | Thin wrapper (~15 lines)      |

---

## 11. Phase 7: Polish & Accessibility

### 11.1 Overview

Final polish: accessibility, consistent formatting, documentation.

### 11.2 Accessibility Checklist

- [ ] **NO_COLOR support**: Verify all colored output respects NO_COLOR
- [ ] **Screen reader mode**: Add --simple flag for linear output
- [ ] **High contrast**: Ensure color choices are distinguishable
- [ ] **Symbol + text**: Never rely on color alone for meaning
- [ ] **Error messages**: Include context and suggestions

### 11.3 Additional Flags

Add `--simple` flag for linear, non-animated output.

### 11.4 Documentation Updates

Update AGENTS.md with new CLI options.

### 11.5 Files Changed

| File                      | Action | Changes                 |
| ------------------------- | ------ | ----------------------- |
| `src/utils/cli-args.ts`   | MODIFY | Add --simple flag       |
| `src/utils/cli-output.ts` | MODIFY | Add simple mode support |
| `AGENTS.md`               | MODIFY | Document new options    |

---

## 12. Phase 8: Advanced Features (Optional)

### 12.1 listr2 Integration

**Decision**: Implement if basic progress isn't sufficient.

```bash
npm install --save-dev listr2
```

Create task list visualization for parallel test execution.

### 12.2 Watch Mode

Use `chokidar` for file watching, re-run on strategy file changes.

### 12.3 HTML Report Generation

Create HTML template, generate from JSON results.

---

## 13. Migration Strategy

### 13.1 Migration Order

1. **Phase 1**: Create new modules (non-breaking)
2. **Phase 2-3**: Add new modules (non-breaking)
3. **Phase 4**: Add new flags (backward compatible)
4. **Phase 5**: Add cancellation (transparent)
5. **Phase 6**: Modularize (careful - functional equivalence required)
6. **Phase 7**: Polish (non-breaking)
7. **Phase 8**: Optional features

### 13.2 Rollback Strategy

Each phase can be rolled back independently:

```bash
git checkout HEAD~N -- src/utils/cli-*.ts src/bench/ src/test-bench.ts
```

### 13.3 Feature Flags

During migration, use feature flags for gradual rollout:

```typescript
const USE_NEW_PROGRESS = process.env.NEW_PROGRESS === "1";
```

---

## 14. Testing Strategy

### 14.1 Manual Testing Checklist

For each phase, verify:

- [ ] `npx ts-node src/test-bench.ts --help` shows updated help
- [ ] `npx ts-node src/test-bench.ts validate --strategy v1-baseline` works
- [ ] `npx ts-node src/test-bench.ts optimize --strategy v1-baseline --case code-001` works
- [ ] `npx ts-node src/test-bench.ts --json optimize --strategy v1-baseline --case code-001` outputs JSON
- [ ] `NO_COLOR=1 npx ts-node src/test-bench.ts` has no colors
- [ ] `CI=true npx ts-node src/test-bench.ts --strategy v1-baseline` doesn't hang
- [ ] Ctrl-C during run saves partial results

### 14.2 Automated Test Script

Create `src/test-cli-output.ts` for automated testing of CLI output module.

### 14.3 CI Integration

Add tests to CI workflow to verify non-interactive mode works.

---

## 15. Risk Assessment

### 15.1 Risk Matrix

| Risk                            | Probability | Impact | Mitigation                             |
| ------------------------------- | ----------- | ------ | -------------------------------------- |
| Breaking existing functionality | Medium      | High   | Incremental changes, extensive testing |
| Performance regression          | Low         | Medium | Benchmark before/after                 |
| Interactive mode breaks         | Medium      | High   | Test in actual terminal                |
| CI compatibility issues         | Medium      | High   | Test in CI early                       |
| Type errors during migration    | High        | Low    | TypeScript will catch                  |

### 15.2 High-Risk Areas

1. **test-bench.ts modularization** (Phase 6)
   - Mitigation: Extract one command at a time, test after each

2. **Progress rendering** (Phase 2)
   - Mitigation: Disable in non-TTY, throttle updates

3. **Interactive mode in CI** (Phase 4)
   - Mitigation: Explicit non-interactive detection

---

## 16. Success Criteria

### 16.1 Phase Completion Criteria

**Phase 1 Complete When**:

- [ ] cli-output.ts and cli-types.ts created
- [ ] All exported functions work
- [ ] npm run lint passes
- [ ] npx tsc --noEmit passes

**Phase 2 Complete When**:

- [ ] cli-progress.ts created
- [ ] Progress bar renders correctly in terminal
- [ ] Progress disabled in non-TTY/CI
- [ ] ETA calculation works

**Phase 3 Complete When**:

- [ ] cli-table3 installed
- [ ] cli-table.ts created
- [ ] Old formatTable() removed
- [ ] All tables render correctly

**Phase 4 Complete When**:

- [ ] --json outputs valid JSON to stdout
- [ ] --quiet suppresses non-error output
- [ ] --no-color disables all ANSI
- [ ] CI detection prevents interactive hang

**Phase 5 Complete When**:

- [ ] Ctrl-C saves partial results
- [ ] Failures summarized at end
- [ ] Rerun commands provided

**Phase 6 Complete When**:

- [ ] test-bench.ts < 100 lines
- [ ] All commands work identically
- [ ] No functionality regression

**Phase 7 Complete When**:

- [ ] NO_COLOR fully supported
- [ ] Documentation updated
- [ ] All accessibility checks pass

### 16.2 Overall Success Criteria

- [ ] All existing test commands work identically
- [ ] npm run build succeeds
- [ ] npm run lint passes
- [ ] CI runs complete without hanging
- [ ] JSON output is valid and complete
- [ ] Progress shows ETA and throughput
- [ ] Ctrl-C saves partial work

---

## 17. Appendix: Code Templates

### 17.1 Migration Template for Console Output

**Find**:

```typescript
console.log(`  ${color.green("V")} ${testCase.id}`);
```

**Replace with**:

```typescript
import { testResult } from "./utils/cli-output";
testResult(testCase.id, true);
```

### 17.2 Migration Template for Progress

**Find**:

```typescript
process.stdout.write(`\r  Progress: ${completed}/${total}`);
```

**Replace with**:

```typescript
import { ProgressManager } from "./utils/cli-progress";
const progress = new ProgressManager({ total, phase: "Processing" });
progress.start();
// In loop:
progress.increment();
// After loop:
progress.finish();
```

### 17.3 Migration Template for Tables

**Find**:

```typescript
console.log(formatTable(headers, rows));
```

**Replace with**:

```typescript
import { createTable, printTable, addRow } from "./utils/cli-table";
const table = createTable({ headers });
for (const row of rows) {
  addRow(table, row);
}
printTable(table);
```

### 17.4 Migration Template for Headers

**Find**:

```typescript
console.log("=".repeat(60));
console.log("SECTION TITLE");
console.log("=".repeat(60));
```

**Replace with**:

```typescript
import { header } from "./utils/cli-output";
header("SECTION TITLE");
```

---

## Execution Checklist

Copy this checklist when starting implementation:

```markdown
## Phase 1: Foundation ✅ COMPLETE (2025-12-28)

- [x] Create src/utils/cli-types.ts (119 lines)
- [x] Create src/utils/cli-output.ts (565 lines)
- [x] Test with npx ts-node -e "import..."
- [x] Run npm run lint
- [x] Run npx tsc --noEmit

## Phase 2: Progress ✅ COMPLETE (2025-12-28)

- [x] Create src/utils/cli-progress.ts (352 lines)
- [x] Test progress bar rendering
- [x] Test ETA calculation
- [x] Test non-TTY behavior

## Phase 3: Tables ✅ COMPLETE (2025-12-28)

- [x] npm install cli-table3
- [x] Create src/utils/cli-table.ts (307 lines)
- [ ] Remove formatTable from test-bench.ts (deferred to Phase 6)
- [ ] Update all table usages (deferred to Phase 6)
- [x] Verify table output

## Phase 4: CI/Automation ✅ COMPLETE (2025-12-28)

- [x] Create src/utils/cli-args.ts (186 lines)
- [ ] Add --json flag to test-bench.ts (deferred to Phase 6)
- [ ] Add --quiet flag (deferred to Phase 6)
- [ ] Add --no-color flag (deferred to Phase 6)
- [x] Test in CI environment

## Phase 5: Error Handling

- [ ] Create src/utils/cli-cancel.ts
- [ ] Integrate cancellation handler
- [ ] Test Ctrl-C behavior
- [ ] Verify partial report saving

## Phase 6: Modularization

- [ ] Create src/bench/ directory
- [ ] Extract args.ts
- [ ] Extract interactive.ts
- [ ] Extract commands/\*.ts
- [ ] Update test-bench.ts
- [ ] Verify all commands work

## Phase 7: Polish

- [ ] Add --simple flag
- [ ] Test NO_COLOR support
- [ ] Update AGENTS.md
- [ ] Final accessibility review

## Phase 8: Advanced (Optional)

- [ ] Evaluate listr2 need
- [ ] Implement if needed
```

---

**End of Implementation Plan**

_Document version: 1.4_
_Last updated: 2025-12-28_
_Phase 1: Complete_
_Phase 2: Complete_
_Phase 3: Complete_
_Phase 4: Complete_
