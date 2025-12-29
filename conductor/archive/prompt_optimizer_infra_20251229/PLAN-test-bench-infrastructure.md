# Implementation Plan: Test Bench Infrastructure

> **Status**: Ready for implementation  
> **Created**: 2024-12-28  
> **Author**: AI-assisted planning

---

## 1. Executive Summary

### Purpose

Build a robust test-bench infrastructure to cache prompt optimizations and eliminate token waste in multi-judge comparisons. This moves the experimental pre-optimization logic from `test-ab-runner.ts` into a dedicated, persistent disk-based caching system.

### Token Savings Estimate

| Scenario                 | API Calls (Current) | API Calls (With Cache) | Savings  |
| ------------------------ | ------------------- | ---------------------- | -------- |
| 3 judges x 20 test cases | 240 opt calls       | 40 opt calls           | **83%**  |
| Re-running same judge    | 40 opt + 40 eval    | 0 opt + 40 eval        | **50%**  |
| Strategy unchanged rerun | Full API cost       | 0 (all cached)         | **100%** |

**Calculation**:

- Current: 20 cases x 2 strategies x 3 judges = 120 optimization pairs x 2 API calls = 240
- With cache: 20 cases x 2 strategies = 40 optimization pairs (cached to disk)
- Judge evaluations always fresh: 20 cases x 3 judges x 2 = 120 eval calls (unchanged)

### Key Deliverables

1. **Disk-based optimization cache** (`.prompt-cache/`)
2. **CLI subcommands**: `validate`, `optimize`, `judge`, `cache`, `compare`
3. **Interactive TUI menu** using @clack/prompts
4. **Stale detection** via prompt content hashing

---

## 2. Architecture Diagram

```
+-------------------------------------------------------------------------+
|                           test-bench.ts                                  |
|  +----------+  +----------+  +----------+  +----------+  +-----------+  |
|  | validate |  | optimize |  |  judge   |  |  cache   |  |  compare  |  |
|  | (FREE)   |  | (cached) |  | (fresh)  |  | (mgmt)   |  |  (diff)   |  |
|  +----+-----+  +----+-----+  +----+-----+  +----+-----+  +-----+-----+  |
|       |             |             |             |              |        |
|       +-------------+------+------+-------------+--------------+        |
|                            |                                             |
|                            v                                             |
|  +-------------------------------------------------------------------+  |
|  |                    Interactive Menu (no args)                      |  |
|  |              @clack/prompts + picocolors TUI                       |  |
|  |  * Action selection    * Strategy picker    * Engine/Model         |  |
|  |  * Test case filter    * Judge selector     * Cost estimate        |  |
|  +-------------------------------------------------------------------+  |
+--------------------------------+----------------------------------------+
                                 |
            +--------------------+--------------------+
            v                                         v
+---------------------------+          +-------------------------------+
|   .prompt-cache/          |          |      ab_results/              |
|   +-- manifest.json       |          |   (Judge results - not cached)|
|   +-- optimizations/      |          |   +-- test_bench_*.json       |
|       +-- v1-baseline_    |          +-------------------------------+
|           gemini_         |
|           gemini-3-flash/ |
|           +-- code-001.json
|           +-- write-001.json
|           +-- edge-001.json
+---------------------------+

Data Flow:
+----------+     +----------+     +----------+     +----------+
| Strategy | --> |  Prompt  | --> |   LLM    | --> |  Cache   |
|  File    |     |Generation|     |Optimize  |     |  (disk)  |
+----------+     +----------+     +----------+     +----+-----+
                                                        |
                                                        v
+----------+     +----------+     +----------+     +----------+
| Results  | <-- |  Judge   | <-- |   LLM    | <-- |  Cached  |
|  (JSON)  |     |Evaluation|     |  Judge   |     |  Output  |
+----------+     +----------+     +----------+     +----------+
```

---

## 3. Interface Definitions

### 3.1 Cache Types (`src/utils/cache.ts`)

```typescript
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { OptimizationMetadata } from "./types";

/**
 * Cached optimization entry stored on disk.
 * Contains the optimized prompt output and metadata for cache invalidation.
 */
export interface CachedOptimizationEntry {
  /** Schema version for forward compatibility */
  schemaVersion: "1.0";

  /** Unique test case identifier (e.g., "code-001") */
  testCaseId: string;

  /** Strategy identifier (e.g., "v1-baseline") */
  strategyId: string;

  /** Engine used for optimization */
  engine: "gemini" | "codex";

  /** Model used (e.g., "gemini-3-flash-preview") */
  model: string;

  /** SHA-256 hash of the input prompt for invalidation detection */
  promptHash: string;

  /** The optimized prompt output from LLM */
  optimizedOutput: string;

  /** Optimization metadata (timing, tokens, retries) */
  metadata: OptimizationMetadata;

  /** ISO timestamp of when this was cached */
  cachedAt: string;
}

/**
 * Manifest file for human-readable cache status.
 * Located at .prompt-cache/manifest.json
 */
export interface CacheManifest {
  /** Last updated timestamp */
  lastUpdated: string;

  /** Total entries in cache */
  totalEntries: number;

  /** Entries grouped by strategy */
  byStrategy: Record<
    string,
    {
      count: number;
      engines: string[];
      lastUpdated: string;
    }
  >;

  /** List of stale entry paths (prompt hash mismatch detected) */
  staleEntries: string[];

  /** Approximate disk usage in bytes */
  diskUsageBytes: number;
}

/**
 * Options for cache operations
 */
export interface CacheOptions {
  /** Force regeneration even if cache exists */
  force?: boolean;

  /** Strategy ID to filter operations */
  strategy?: string;

  /** Engine to filter operations */
  engine?: "gemini" | "codex";

  /** Model to filter operations */
  model?: string;
}

/**
 * Result of a cache clear operation
 */
export interface CacheClearResult {
  /** Number of entries cleared */
  cleared: number;

  /** Total entries before clearing */
  total: number;

  /** Bytes freed */
  bytesFreed: number;
}
```

### 3.2 Cache Manager Class

```typescript
/**
 * Manages disk-based optimization cache.
 *
 * Cache structure:
 * .prompt-cache/
 * +-- manifest.json
 * +-- optimizations/
 *     +-- {strategy}_{engine}_{model}/
 *         +-- {test_case_id}.json
 *
 * @example
 * const cache = new CacheManager();
 * const entry = cache.get("v1-baseline", "gemini", "gemini-3-flash-preview", "code-001", currentHash);
 * if (!entry) {
 *   // Run optimization
 *   cache.set(newEntry);
 * }
 */
export class CacheManager {
  private readonly cacheDir: string;
  private readonly optimizationsDir: string;
  private readonly manifestPath: string;

  /**
   * @param baseDir - Base directory for cache (defaults to .prompt-cache/)
   */
  constructor(baseDir?: string);

  /**
   * Generate cache key from optimization parameters.
   * Format: {strategy}_{engine}_{model}/{test_case_id}
   *
   * @returns Relative path for cache file (without .json extension)
   */
  getCacheKey(strategyId: string, engine: string, model: string, testCaseId: string): string;

  /**
   * Compute SHA-256 hash of prompt content for invalidation detection.
   * Includes both the generated prompt and any relevant context.
   */
  computePromptHash(prompt: string): string;

  /**
   * Get cached optimization if valid, or null if missing/stale.
   *
   * @param strategyId - Strategy identifier (e.g., "v1-baseline")
   * @param engine - Engine name (e.g., "gemini")
   * @param model - Model name (e.g., "gemini-3-flash-preview")
   * @param testCaseId - Test case ID (e.g., "code-001")
   * @param currentPromptHash - Hash of current prompt for staleness check
   * @returns Cached entry if valid and fresh, null if missing or stale
   */
  get(
    strategyId: string,
    engine: string,
    model: string,
    testCaseId: string,
    currentPromptHash: string,
  ): CachedOptimizationEntry | null;

  /**
   * Check if entry is stale (prompt hash mismatch).
   * Stale entries indicate the strategy has changed since caching.
   */
  isStale(entry: CachedOptimizationEntry, currentPromptHash: string): boolean;

  /**
   * Store optimization result in cache.
   * Creates directory structure if needed.
   */
  set(entry: CachedOptimizationEntry): void;

  /**
   * Get cache status summary.
   * Reads manifest or rebuilds if missing.
   */
  getStatus(): CacheManifest;

  /**
   * Clear cache entries matching filter.
   *
   * @param options - Filter options (strategy, engine, model)
   * @returns Clear result with count and bytes freed
   */
  clear(options?: CacheOptions): CacheClearResult;

  /**
   * List all stale entries (entries where current prompt hash doesn't match).
   * Requires passing a map of testCaseId -> currentPromptHash.
   */
  listStaleEntries(strategyId: string, engine: string, model: string, hashMap: Map<string, string>): string[];

  /**
   * Rebuild and update manifest file.
   * Called automatically after set/clear operations.
   */
  private updateManifest(): void;

  /**
   * Ensure cache directories exist.
   */
  private ensureDirectories(): void;
}
```

### 3.3 Test Bench Types

```typescript
/**
 * CLI arguments for test-bench commands
 */
export interface TestBenchArgs {
  /** Subcommand: validate | optimize | judge | cache | compare */
  command: "validate" | "optimize" | "judge" | "cache" | "compare";

  /** Subcommand for cache: status | clear */
  cacheSubcommand?: "status" | "clear";

  /** Strategy path or ID */
  strategy?: string;

  /** Specific test case IDs to run */
  cases?: string[];

  /** Engine to use */
  engine?: "gemini" | "codex";

  /** Model override */
  model?: string;

  /** Judge ID for evaluation */
  judge?: JudgeId;

  /** Force regeneration (bypass cache) */
  force?: boolean;

  /** Clear all cache entries */
  all?: boolean;

  /** Files for comparison */
  runs?: [string, string];
}

/**
 * Result from test bench execution
 */
export interface TestBenchResult {
  /** Command that was executed */
  command: string;

  /** Number of test cases processed */
  testCaseCount: number;

  /** Execution duration in seconds */
  durationSeconds: number;

  /** Output file path (if applicable) */
  outputPath?: string;

  /** Summary statistics */
  summary: {
    passed: number;
    failed: number;
    skipped: number;
    cacheHits?: number;
    cacheMisses?: number;
  };
}
```

---

## 4. CLI Subcommand Specifications

### 4.1 `validate` - Structure Validation (FREE)

```bash
npx ts-node src/test-bench.ts validate --strategy v1-baseline [--case code-001]
```

**Purpose**: Run local structure validation without API calls.

**Output Example**:

```
Validating v1-baseline strategy...

  code-001
  code-003
  edge-001
   Missing: <instructions>
  write-001

Summary: 3/4 passed
```

---

### 4.2 `optimize` - Generate and Cache Optimizations

```bash
npx ts-node src/test-bench.ts optimize \
  --strategy v1-baseline \
  [--engine gemini] \
  [--model gemini-3-flash-preview] \
  [--force] \
  [--case code-001]
```

**Purpose**: Generate optimizations and store in disk cache.

**Behavior**:

1. Load strategy and test cases
2. For each test case:
   - Generate prompt
   - Compute prompt hash
   - Check cache: `cache.get(strategy, engine, model, testCaseId, hash)`
   - If hit (and not `--force`): Skip, log "cached"
   - If miss or stale: Run LLM, store result
3. Update manifest

**Output Example**:

```
Optimizing with v1-baseline (gemini/gemini-3-flash-preview)...

  code-001 (cached)
  code-003 (optimized in 2340ms)
  edge-001 (stale - regenerating)
  edge-001 (optimized in 1890ms)
  write-001 (cached)

Summary: 4 test cases, 2 cache hits, 2 API calls
Duration: 4.5s
```

---

### 4.3 `judge` - Run Judge Evaluation

```bash
npx ts-node src/test-bench.ts judge \
  --strategy v1-baseline \
  --judge gemini-flash \
  [--case code-001]
```

**Purpose**: Evaluate cached optimizations with LLM judge.

**Requirements**:

- Cached optimizations MUST exist (error if missing)
- Judge evaluations are ALWAYS fresh (never cached)

**Output Example**:

```
Judging v1-baseline with gemini-flash...

  code-001: score=4.20 (structure: pass, context: pass)
  code-003: score=3.80 (structure: pass, context: pass)
  edge-001: score=3.50 (structure: pass, context: N/A)
  write-001: score=4.50 (structure: pass, context: N/A)

Summary: 4/4 passed, avg score: 4.00
Results saved to: ab_results/test_bench_v1-baseline_gemini-flash_2024-12-28T10-30-00.json
```

---

### 4.4 `cache status` - View Cache Status

```bash
npx ts-node src/test-bench.ts cache status
```

**Output Example**:

```
Cache Status (.prompt-cache/)

Total entries: 24
Disk usage: 156 KB

By Strategy:
+--------------+-------+---------------------+--------------+
| Strategy     | Count | Engines             | Last Updated |
+--------------+-------+---------------------+--------------+
| v1-baseline  | 16    | gemini, codex       | 2 hours ago  |
| v2-lean      | 8     | gemini              | 1 day ago    |
+--------------+-------+---------------------+--------------+

Stale entries: 2
  - v1-baseline_gemini_gemini-3-flash-preview/edge-001
  - v2-lean_gemini_gemini-3-flash-preview/complex-001
```

---

### 4.5 `cache clear` - Clear Cache

```bash
npx ts-node src/test-bench.ts cache clear [--strategy v1-baseline] [--all]
```

**Output Example**:

```
Clearing cache...

Filter: strategy=v1-baseline
Cleared: 16 entries (98 KB freed)

Remaining: 8 entries
```

---

### 4.6 `compare` - Compare Results

```bash
npx ts-node src/test-bench.ts compare --runs file1.json file2.json
```

**Output Example**:

```
Comparing Results

File A: test_bench_v1-baseline_codex-high_2024-12-27.json
File B: test_bench_v1-baseline_gemini-flash_2024-12-28.json

Score Comparison:
+-----------+---------+---------+--------+
| Test Case | File A  | File B  | Delta  |
+-----------+---------+---------+--------+
| code-001  | 4.20    | 4.10    | -0.10  |
| code-003  | 3.80    | 3.90    | +0.10  |
| edge-001  | 3.50    | 3.40    | -0.10  |
| write-001 | 4.50    | 4.60    | +0.10  |
+-----------+---------+---------+--------+
| Average   | 4.00    | 4.00    |  0.00  |
+-----------+---------+---------+--------+

Agreement: 100% (4/4 same pass/fail)
Correlation: r=0.95
```

---

## 5. Interactive Menu Specification

When run with no arguments, launch interactive TUI with FULL configuration options:

**Features**:

- Action selection (validate/optimize/judge/full-run/cache/compare)
- Strategy selection
- Engine selection (gemini/codex)
- Model selection
- Test case multiselect with "all" and "smoke" presets
- Judge selection
- Force flag option
- Cost estimation before execution
- Confirmation prompt
- Progress spinner during execution
- Results summary

**Library**: `@clack/prompts` with `picocolors`

---

## 6. File-by-File Implementation

### File 1: `src/utils/cache.ts` (NEW - ~200 lines)

**Responsibilities**:

- `CacheManager` class implementation
- SHA-256 hashing with `crypto`
- JSON file I/O with `fs`
- Directory structure management
- Manifest generation and updates

### File 2: `src/test-bench.ts` (NEW - ~500 lines)

**Responsibilities**:

- Main CLI entry point
- Argument parsing
- Interactive menu
- Command execution routing

### File 3: `.gitignore` (MODIFY)

Add:

```gitignore
# Prompt optimization cache
.prompt-cache/
```

### File 4: `package.json` (MODIFY)

Add dev dependencies (these are CLI tools, not Raycast runtime):

```json
{
  "devDependencies": {
    "@clack/prompts": "^0.11.0",
    "picocolors": "^1.1.1"
  }
}
```

### File 5: `src/utils/evaluator.ts` (MODIFY)

Export the local validation function for reuse:

```typescript
// Change line 137 from:
function validateStructureLocally(output: string): boolean {

// To:
export function validateStructureLocally(output: string): boolean {
```

---

## 7. Implementation Order (Build Sequence)

### Phase 1: Cache Infrastructure (Est: 3 hours)

- [ ] Create `src/utils/cache.ts`
- [ ] Implement interfaces: `CachedOptimizationEntry`, `CacheManifest`, `CacheOptions`
- [ ] Implement `CacheManager` class with all methods
- [ ] Update `.gitignore`

### Phase 2: CLI Foundation (Est: 1.5 hours)

- [ ] Create `src/test-bench.ts` skeleton
- [ ] Implement `parseArgs()` with subcommand detection
- [ ] Add main() with command routing
- [ ] Run `npm install --save-dev @clack/prompts@^0.11.0 picocolors@^1.1.1`

### Phase 3: validate Command (Est: 1 hour)

- [ ] Implement `runValidate()` function
- [ ] Reuse `loadStrategy()` and `generatePrompt()` patterns
- [ ] Test with smoke test cases

### Phase 4: optimize Command (Est: 3 hours)

- [ ] Implement `runOptimize()` function
- [ ] Integrate cache read/write
- [ ] Handle `--force` flag and stale detection

### Phase 5: judge Command (Est: 2.5 hours)

- [ ] Implement `runJudge()` function
- [ ] Check for cached optimizations
- [ ] Save results to `ab_results/`

### Phase 6: cache Commands (Est: 1.5 hours)

- [ ] Implement `runCacheStatus()` function
- [ ] Implement `runCacheClear()` function

### Phase 7: compare Command (Est: 1.5 hours)

- [ ] Implement `runCompare()` function
- [ ] Calculate deltas and agreement rates

### Phase 8: Interactive Menu (Est: 3 hours)

- [ ] Implement `interactiveMode()` function
- [ ] All configuration prompts
- [ ] Cost estimation
- [ ] Full end-to-end testing

**Total Estimated Time: ~17 hours**

---

## 8. Testing Strategy

### Smoke Test Cases

| ID          | Description             | Why Selected               |
| ----------- | ----------------------- | -------------------------- |
| `code-001`  | Has context, quick mode | Tests context preservation |
| `write-001` | No context, quick mode  | Tests basic optimization   |
| `edge-001`  | Empty context string    | Tests edge case handling   |

### Phase-Specific Test Commands

| Phase | Command                                                                                                          | Expected Outcome           |
| ----- | ---------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 3     | `npx ts-node src/test-bench.ts validate --strategy src/prompts/v1-baseline.ts`                                   | Pass/fail output           |
| 4     | `npx ts-node src/test-bench.ts optimize --strategy src/prompts/v1-baseline.ts --case code-001`                   | Creates cache file         |
| 4     | (run same command again)                                                                                         | Uses cache, shows "cached" |
| 5     | `npx ts-node src/test-bench.ts judge --strategy src/prompts/v1-baseline.ts --judge gemini-flash --case code-001` | Creates result file        |
| 6     | `npx ts-node src/test-bench.ts cache status`                                                                     | Shows manifest             |
| 6     | `npx ts-node src/test-bench.ts cache clear --strategy v1-baseline`                                               | Clears entries             |
| 8     | `npx ts-node src/test-bench.ts` (no args)                                                                        | Interactive menu appears   |

---

## 9. Risk Assessment

| Risk                                | Likelihood | Impact | Mitigation                                              |
| ----------------------------------- | ---------- | ------ | ------------------------------------------------------- |
| Cache corruption                    | Low        | Medium | Schema versioning, manifest validation, auto-rebuild    |
| Stale cache false positives         | Medium     | Low    | Clear warning messages, `--force` flag always available |
| @clack/prompts compatibility        | Low        | Medium | Pin version in package.json, test on Node 18+           |
| Large cache disk usage              | Low        | Low    | Add `cache clear --older-than` in future iteration      |
| API rate limits during optimization | Medium     | Medium | Reuse existing retry logic from test-utils.ts           |
| Interactive mode on CI              | Low        | Low    | Auto-detect non-TTY and skip interactive                |

---

## 10. Execution Checklist

### Phase 1: Cache Infrastructure

- [ ] Create `src/utils/cache.ts`
- [ ] Implement `CachedOptimizationEntry` interface
- [ ] Implement `CacheManifest` interface
- [ ] Implement `CacheOptions` interface
- [ ] Implement `CacheManager.constructor()`
- [ ] Implement `CacheManager.ensureDirectories()`
- [ ] Implement `CacheManager.getCacheKey()`
- [ ] Implement `CacheManager.computePromptHash()`
- [ ] Implement `CacheManager.get()`
- [ ] Implement `CacheManager.set()`
- [ ] Implement `CacheManager.isStale()`
- [ ] Implement `CacheManager.getStatus()`
- [ ] Implement `CacheManager.clear()`
- [ ] Implement `CacheManager.listStaleEntries()`
- [ ] Implement `CacheManager.updateManifest()`
- [ ] Update `.gitignore` with `.prompt-cache/`
- [ ] Export `validateStructureLocally()` from `src/utils/evaluator.ts`

### Phase 2: CLI Foundation

- [ ] Create `src/test-bench.ts` skeleton
- [ ] Add shebang and imports
- [ ] Implement `parseArgs()` with subcommand detection
- [ ] Implement main() with command routing
- [ ] Add no-args -> interactive mode detection
- [ ] Run `npm install --save-dev @clack/prompts@^0.11.0 picocolors@^1.1.1`

### Phase 3: validate Command

- [ ] Copy `loadStrategy()` from test-ab-runner.ts
- [ ] Copy `generatePrompt()` from test-ab-runner.ts
- [ ] Implement `runValidate()` function
- [ ] Handle `--strategy` flag
- [ ] Handle `--case` filter
- [ ] Output pass/fail with missing tag details

### Phase 4: optimize Command

- [ ] Implement `runOptimize()` function
- [ ] Integrate CacheManager.get() check
- [ ] Implement prompt hash computation
- [ ] Add engine execution (gemini/codex)
- [ ] Integrate CacheManager.set() storage
- [ ] Handle `--force` flag
- [ ] Implement stale detection warnings

### Phase 5: judge Command

- [ ] Implement `runJudge()` function
- [ ] Check for cached optimizations (error if missing)
- [ ] Call evaluateWithMetadata() with cached output
- [ ] Format and display evaluation results
- [ ] Save results to ab_results/
- [ ] Handle `--judge` flag for judge selection

### Phase 6: cache Commands

- [ ] Implement `runCacheStatus()` function
- [ ] Format status as table
- [ ] Implement `runCacheClear()` function
- [ ] Handle `--strategy` filter
- [ ] Handle `--all` flag

### Phase 7: compare Command

- [ ] Implement `runCompare()` function
- [ ] Load two JSON result files
- [ ] Calculate score deltas per test case
- [ ] Calculate agreement rates
- [ ] Output formatted comparison table

### Phase 8: Interactive Menu

- [ ] Implement `interactiveMode()` function
- [ ] Action selection (validate/optimize/judge/full-run/cache/compare)
- [ ] Cache subcommand selection (status/clear)
- [ ] Strategy selection
- [ ] Engine selection
- [ ] Model selection
- [ ] Test case multiselect with "all" and "smoke" options
- [ ] Judge selection
- [ ] Force flag confirm
- [ ] Implement `calculateCostEstimate()`
- [ ] Cost estimate note display
- [ ] Confirmation before execution
- [ ] Spinner during execution
- [ ] Results summary note
- [ ] Outro message

### Final Validation

- [ ] Run `npm run lint` - no errors
- [ ] Run `npm run build` - no errors
- [ ] Test all smoke test cases (code-001, write-001, edge-001)
- [ ] Verify cache files in correct structure
- [ ] Verify results saved to ab_results/
- [ ] Verify interactive mode works end-to-end

---

## Appendix: Code Patterns to Reuse

### From `test-ab-runner.ts`

```typescript
// Strategy Loading
async function loadStrategy(strategyPath: string): Promise<PromptStrategy> {
  const absolutePath = path.resolve(process.cwd(), strategyPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Strategy file not found: ${absolutePath}`);
  }
  const module = await import(absolutePath);
  const strategy: PromptStrategy =
    module.default || module.v1Baseline || module.v2Candidate || module.strategy || module;
  if (
    typeof strategy.id !== "string" ||
    typeof strategy.buildQuickPrompt !== "function" ||
    typeof strategy.buildDetailedPrompt !== "function"
  ) {
    throw new Error(`Invalid strategy file: ${strategyPath}. Must export a PromptStrategy object.`);
  }
  return strategy;
}

// Prompt Generation
function generatePrompt(strategy: PromptStrategy, testCase: TestCase): string {
  if (testCase.mode === "quick") {
    return strategy.buildQuickPrompt(testCase.userRequest, testCase.additionalContext, testCase.persona);
  } else {
    return strategy.buildDetailedPrompt(testCase.userRequest, testCase.additionalContext, testCase.persona);
  }
}
```

### From `evaluator.ts`

```typescript
// Local Structure Validation (FREE) - NOTE: Must be exported for test-bench.ts to import
export function validateStructureLocally(output: string): boolean {
  const hasRole = /^\s*<role>/im.test(output);
  const hasObjective = /^\s*<objective>/im.test(output);
  const hasInstructionsOrProtocol = /^\s*<instructions>/im.test(output) || /^\s*<execution_protocol>/im.test(output);
  return hasRole && hasObjective && hasInstructionsOrProtocol;
}
```

### From `test-utils.ts`

```typescript
// Engine Execution with Metadata
runGeminiWithMetadata(prompt, { model }): Promise<GeminiRunResult>
runWithEngine(engine, prompt, { model, reasoningEffort }): Promise<string>
withRetry(fn, maxRetries, baseDelayMs): Promise<T>
```

---

## Appendix: @clack/prompts Quick Reference

```typescript
import * as p from "@clack/prompts";
import color from "picocolors";

// Session
p.intro(color.bgCyan(color.black(" App Name ")));
p.outro("Done!");

// Prompts
const name = await p.text({ message: "Name?", validate: (v) => !v && "Required" });
const confirmed = await p.confirm({ message: "Sure?", initialValue: true });
const choice = await p.select({ message: "Pick one", options: [{ value: "a", label: "A" }] });
const choices = await p.multiselect({ message: "Pick many", options: [...], required: true });

// Group (wizard)
const config = await p.group(
  {
    step1: () => p.text({ message: "Step 1" }),
    step2: ({ results }) => p.select({ message: `For ${results.step1}`, options: [...] }),
  },
  { onCancel: () => { p.cancel("Cancelled."); process.exit(0); } }
);

// Spinner
const s = p.spinner();
s.start("Working...");
s.message("Still working...");  // Update message while spinning
s.stop("Done!");
s.cancel("Aborted");            // Red cancel message
s.error("Failed");              // Red error message
s.clear();                      // Clear spinner line
// s.isCancelled                // Readonly: check if cancelled

// Logging
p.log.info("Info");
p.log.success("Success");       // Green checkmark
p.log.step("Step");             // Step indicator
p.log.warn("Warning");
p.log.error("Error");
p.note("Content", "Title");

// Cancellation
if (p.isCancel(value)) { p.cancel("Cancelled."); process.exit(0); }
```
