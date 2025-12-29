# Plan: Fix Judge Optimization & Update Test Cases

**Goal**: Eliminate redundant optimization calls (67% cost reduction) and replace trivial test cases with realistic scenarios.

**Status**: READY FOR IMPLEMENTATION

---

## Task 1: Fix Redundant Optimization in Judge Comparison

### Problem Analysis

**Current Issue**: `runJudgeComparison()` in `src/test-ab-runner.ts` (lines 403-515) calls `runTestCase()` for each of 3 judges, resulting in optimization running 3x redundantly per test case.

**Current Flow**:

```
For each judge (3 judges):
  For each test case (N cases):
    runTestCase() → optimize baseline + candidate → evaluate with judge
```

**Cost Impact**:

- 12 test cases × 2 strategies × 3 judges = **72 optimization calls**
- Only **24 optimization calls needed** (67% reduction)

### Solution: Two-Phase Approach

**Phase 1**: Pre-optimize all test cases once, cache results  
**Phase 2**: Evaluate cached optimizations with each judge

---

### Step 1.1: Define Cached Optimization Interface

**File**: `src/test-ab-runner.ts`  
**Location**: After line 71 (after `type BenchmarkReport = BenchmarkReportV3;`)

```typescript
interface CachedOptimization {
  testCaseId: string;
  baselineOutput: string;
  candidateOutput: string;
  baselineMeta: OptimizationMetadata;
  candidateMeta: OptimizationMetadata;
}
```

---

### Step 1.2: Add TimingData Import

**File**: `src/test-ab-runner.ts`  
**Location**: Line 21-28 (update existing import)

```typescript
import {
  EvaluationResultV3,
  evaluateWithMetadata,
  OptimizationMetadata,
  TimingData, // ADD THIS
  JUDGES,
  JudgeConfig,
  JudgeId,
} from "./utils/evaluator";
```

---

### Step 1.3: Create `optimizeAllTestCases()` Function

**File**: `src/test-ab-runner.ts`  
**Location**: After line 211 (after `generatePrompt()` function, before `// --- Dry Run ---`)

```typescript
// --- Optimization Caching ---

/**
 * Pre-optimize all test cases once, returning cached results for reuse across judges.
 */
async function optimizeAllTestCases(
  testCases: TestCase[],
  baseline: PromptStrategy,
  candidate: PromptStrategy,
  engine: "gemini" | "codex",
  model: string | undefined,
  concurrency: number,
): Promise<Map<string, CachedOptimization>> {
  const cache = new Map<string, CachedOptimization>();
  const limit = pLimit(concurrency);

  console.log(`\n📦 Pre-optimizing ${testCases.length} test cases...`);

  const tasks = testCases.map((testCase, index) =>
    limit(async () => {
      const baselinePrompt = generatePrompt(baseline, testCase);
      const candidatePrompt = generatePrompt(candidate, testCase);

      process.stdout.write(`  [${index + 1}/${testCases.length}] ${testCase.id}`);

      const buildMeta = (geminiResult: GeminiRunResult, prompt: string): OptimizationMetadata => ({
        timing: geminiResult.timing,
        retry: {
          attempts: geminiResult.retry.attempts,
          totalRetryDelayMs: geminiResult.retry.totalRetryDelayMs,
          failedAttempts: geminiResult.retry.failedAttempts,
        },
        tokens: geminiResult.tokens,
        promptCharCount: prompt.length,
        outputCharCount: geminiResult.response.length,
      });

      if (engine === "gemini") {
        const t1 = Date.now();
        const [baselineResult, candidateResult] = await Promise.all([
          runGeminiWithMetadata(baselinePrompt, { model }),
          runGeminiWithMetadata(candidatePrompt, { model }),
        ]);
        const optTime = ((Date.now() - t1) / 1000).toFixed(1);
        console.log(` → ${optTime}s`);

        cache.set(testCase.id, {
          testCaseId: testCase.id,
          baselineOutput: baselineResult.response,
          candidateOutput: candidateResult.response,
          baselineMeta: buildMeta(baselineResult, baselinePrompt),
          candidateMeta: buildMeta(candidateResult, candidatePrompt),
        });
      } else {
        // Codex path
        const runWithTiming = async (prompt: string): Promise<{ output: string; timing: TimingData }> => {
          const startMs = Date.now();
          const output = await withRetry(() => runWithEngine(engine, prompt, { model }));
          const endMs = Date.now();
          return { output, timing: { startMs, endMs, durationMs: endMs - startMs } };
        };

        const t1 = Date.now();
        const [baselineRun, candidateRun] = await Promise.all([
          runWithTiming(baselinePrompt),
          runWithTiming(candidatePrompt),
        ]);
        const optTime = ((Date.now() - t1) / 1000).toFixed(1);
        console.log(` → ${optTime}s`);

        const codexMeta = (prompt: string, run: { output: string; timing: TimingData }): OptimizationMetadata => ({
          timing: run.timing,
          retry: { attempts: 1, totalRetryDelayMs: 0, failedAttempts: [] },
          tokens: null,
          promptCharCount: prompt.length,
          outputCharCount: run.output.length,
        });

        cache.set(testCase.id, {
          testCaseId: testCase.id,
          baselineOutput: baselineRun.output,
          candidateOutput: candidateRun.output,
          baselineMeta: codexMeta(baselinePrompt, baselineRun),
          candidateMeta: codexMeta(candidatePrompt, candidateRun),
        });
      }
    }),
  );

  await Promise.all(tasks);
  console.log(`  ✅ Pre-optimization complete (${cache.size} test cases cached)\n`);

  return cache;
}

/**
 * Evaluate pre-optimized outputs with a specific judge.
 * Does NOT re-run optimization - uses cached results.
 */
async function evaluateCachedTestCase(
  testCase: TestCase,
  cached: CachedOptimization,
  baseline: PromptStrategy,
  candidate: PromptStrategy,
  judge: JudgeConfig,
): Promise<{ baseline: EvaluationResultV3; candidate: EvaluationResultV3 }> {
  const [baselineEval, candidateEval] = await Promise.all([
    evaluateWithMetadata(
      testCase.id,
      baseline.id,
      testCase.userRequest,
      testCase.additionalContext,
      cached.baselineOutput,
      cached.baselineMeta,
      judge,
    ),
    evaluateWithMetadata(
      testCase.id,
      candidate.id,
      testCase.userRequest,
      testCase.additionalContext,
      cached.candidateOutput,
      cached.candidateMeta,
      judge,
    ),
  ]);

  return { baseline: baselineEval, candidate: candidateEval };
}
```

---

### Step 1.4: Refactor `runJudgeComparison()` Function

**File**: `src/test-ab-runner.ts`  
**Replace**: Entire `runJudgeComparison()` function (lines 403-515)

```typescript
async function runJudgeComparison(
  testCases: TestCase[],
  baseline: PromptStrategy,
  candidate: PromptStrategy,
  engine: "gemini" | "codex",
  model: string | undefined,
  concurrency: number,
): Promise<void> {
  const judgeIds: JudgeId[] = ["grok-code", "gemini-flash", "codex-medium"];
  const judgeResults: JudgeComparisonResult[] = [];

  console.log("\n⚖️  JUDGE COMPARISON MODE");
  console.log("═".repeat(50));
  console.log(`Running ${testCases.length} test cases with ${judgeIds.length} judges...`);

  // PHASE 1: Pre-optimize all test cases ONCE
  const optimizationCache = await optimizeAllTestCases(testCases, baseline, candidate, engine, model, concurrency);

  // PHASE 2: Evaluate with each judge (reusing cached optimizations)
  for (const judgeId of judgeIds) {
    const judgeConfig = JUDGES[judgeId];
    console.log(`\n🔍 Evaluating with judge: ${judgeId}...`);

    const scores: { baseline: number[]; candidate: number[] } = { baseline: [], candidate: [] };
    const decisions: Array<"baseline" | "candidate" | "tie"> = [];
    const latencyMs: number[] = [];

    for (let index = 0; index < testCases.length; index++) {
      const testCase = testCases[index];
      const cached = optimizationCache.get(testCase.id);

      if (!cached) {
        console.log(`    [${index + 1}/${testCases.length}] ${testCase.id} ✗ Missing cached optimization`);
        continue;
      }

      const startMs = Date.now();
      process.stdout.write(`    [${index + 1}/${testCases.length}] ${testCase.id}`);

      try {
        const result = await evaluateCachedTestCase(testCase, cached, baseline, candidate, judgeConfig);
        latencyMs.push(Date.now() - startMs);

        scores.baseline.push(result.baseline.totalScore);
        scores.candidate.push(result.candidate.totalScore);

        const winner =
          result.candidate.totalScore > result.baseline.totalScore
            ? "candidate"
            : result.baseline.totalScore > result.candidate.totalScore
              ? "baseline"
              : "tie";
        decisions.push(winner);

        console.log(
          ` → B:${result.baseline.totalScore.toFixed(1)} C:${result.candidate.totalScore.toFixed(1)} (${winner})`,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(` ✗ ${msg.slice(0, 60)}`);
      }
    }

    judgeResults.push({ judgeId, scores, decisions, latencyMs });
  }

  // Calculate comparison metrics
  console.log("\n" + "═".repeat(50));
  console.log("📊 JUDGE COMPARISON RESULTS");
  console.log("═".repeat(50));

  // Per-judge summary
  console.log("\n📈 Per-Judge Summary:");
  for (const jr of judgeResults) {
    const bAvg =
      jr.scores.baseline.length > 0 ? jr.scores.baseline.reduce((a, b) => a + b, 0) / jr.scores.baseline.length : 0;
    const cAvg =
      jr.scores.candidate.length > 0 ? jr.scores.candidate.reduce((a, b) => a + b, 0) / jr.scores.candidate.length : 0;
    const avgLatency = jr.latencyMs.length > 0 ? jr.latencyMs.reduce((a, b) => a + b, 0) / jr.latencyMs.length : 0;
    const candidateWins = jr.decisions.filter((d) => d === "candidate").length;
    const baselineWins = jr.decisions.filter((d) => d === "baseline").length;
    const ties = jr.decisions.filter((d) => d === "tie").length;

    console.log(`\n  ${jr.judgeId}:`);
    console.log(`    Baseline avg: ${bAvg.toFixed(2)}, Candidate avg: ${cAvg.toFixed(2)}`);
    console.log(`    Decisions: candidate=${candidateWins}, baseline=${baselineWins}, tie=${ties}`);
    console.log(`    Avg latency: ${avgLatency.toFixed(0)}ms`);
  }

  // Agreement rate between judges
  console.log("\n🤝 Agreement Rate:");
  for (let i = 0; i < judgeResults.length; i++) {
    for (let j = i + 1; j < judgeResults.length; j++) {
      const jr1 = judgeResults[i];
      const jr2 = judgeResults[j];
      let agree = 0;
      const minLen = Math.min(jr1.decisions.length, jr2.decisions.length);
      for (let k = 0; k < minLen; k++) {
        if (jr1.decisions[k] === jr2.decisions[k]) agree++;
      }
      const rate = minLen > 0 ? (agree / minLen) * 100 : 0;
      console.log(`  ${jr1.judgeId} vs ${jr2.judgeId}: ${rate.toFixed(1)}% (${agree}/${minLen})`);
    }
  }

  // Score correlation between judges
  console.log("\n📉 Score Correlation (Pearson r):");
  for (let i = 0; i < judgeResults.length; i++) {
    for (let j = i + 1; j < judgeResults.length; j++) {
      const jr1 = judgeResults[i];
      const jr2 = judgeResults[j];
      const allScores1 = [...jr1.scores.baseline, ...jr1.scores.candidate];
      const allScores2 = [...jr2.scores.baseline, ...jr2.scores.candidate];
      const r = pearsonCorrelation(allScores1, allScores2);
      console.log(`  ${jr1.judgeId} vs ${jr2.judgeId}: r=${r.toFixed(3)}`);
    }
  }

  // Cost estimate (rough)
  console.log("\n💰 Estimated Cost (per 1000 evaluations):");
  console.log("  codex-high:   ~$15.00 (high reasoning)");
  console.log("  codex-medium: ~$10.00 (medium reasoning)");
  console.log("  gemini-flash: ~$0.75  (flash tier)");
}
```

---

### Cost Reduction Summary

| Scenario                | Before           | After            | Savings              |
| ----------------------- | ---------------- | ---------------- | -------------------- |
| 12 test cases, 3 judges | 72 optimizations | 24 optimizations | **67% reduction**    |
| API cost estimate       | ~$5.40           | ~$1.80           | ~$3.60 saved per run |

---

## Task 2: Update Test Cases

### Step 2.1: Remove "simple" Category Cases

**File**: `src/test-data/test-cases-quick.ts`

Remove these 3 test cases (lines 125-144):

- `simple-001` (localStorage vs sessionStorage)
- `simple-002` (CAP theorem)
- `simple-003` (PostgreSQL vs MongoDB)

**Reason**: Trivial knowledge lookups don't benefit from prompt optimization.

---

### Step 2.2: Add 4 New "complex" Category Cases

**File**: `src/test-data/test-cases-quick.ts`  
**Location**: After `data-002` and before `edge-001`

```typescript
  // --- COMPLEX CATEGORY (new) ---
  {
    id: "complex-001",
    category: "complex",
    description: "Multi-step migration task with constraints",
    userRequest: "Migrate our user authentication from session-based to JWT tokens. We need to maintain backward compatibility for mobile clients running older app versions for 90 days.",
    additionalContext: `Current stack:
- Express.js backend with express-session
- PostgreSQL for session storage
- Redis for session cache
- Mobile apps: iOS 3.2.1, Android 4.0.0 (both use session cookies)
- Web app: React SPA

Constraints:
- Zero downtime during migration
- Must pass SOC2 audit in 45 days
- Team: 2 backend devs, 1 mobile dev`,
    mode: "quick",
  },
  {
    id: "complex-002",
    category: "complex",
    description: "Output format with specific structure requirements",
    userRequest: "Generate a weekly status report for my team's sprint. Include blockers, completed items, and next week's priorities. Format it for both Slack posting and email.",
    additionalContext: `Sprint 47 data:
Completed: AUTH-123 (JWT migration phase 1), AUTH-124 (token refresh), FE-89 (login redesign)
In Progress: AUTH-125 (session cleanup cron), FE-90 (2FA UI) - blocked by design review
Blocked: INFRA-45 (Redis cluster) - waiting on AWS quota increase
Velocity: 21 points completed, 8 carried over

Team: Alice (backend), Bob (frontend), Carol (QA - out sick Thu-Fri)`,
    mode: "quick",
  },
  {
    id: "complex-003",
    category: "complex",
    description: "Domain-specific technical task with nuanced requirements",
    userRequest: "Create a database schema for a multi-tenant SaaS billing system that supports usage-based pricing, subscription tiers, and prorated upgrades/downgrades.",
    additionalContext: `Business requirements:
- Tenants can have multiple subscriptions (e.g., main product + add-ons)
- Usage metrics: API calls, storage GB, active users
- Billing cycles: monthly, annual (with discount)
- Support mid-cycle plan changes with proration
- Need audit trail for compliance
- Must support currencies: USD, EUR, GBP

Tech constraints:
- PostgreSQL 15
- Must work with Stripe as payment processor
- Eventually consistent is OK for usage counters`,
    mode: "quick",
  },
  {
    id: "complex-004",
    category: "complex",
    description: "Debugging with incomplete information",
    userRequest: "Our API is returning 504 Gateway Timeout errors intermittently. They started yesterday after a deployment. Help me debug this.",
    additionalContext: `What we know:
- Deployment: Added caching layer (Redis) for user profiles
- Errors: ~2% of requests to /api/users/:id endpoint
- No errors in other endpoints
- Redis connection pool: 10 connections
- API timeout config: 30s
- Database: response times normal (p99 < 50ms)

Things we've tried:
- Restarted API pods - no change
- Checked Redis memory - 40% used
- No recent DNS changes`,
    mode: "quick",
  },
```

---

### Step 2.3: Update CLI Help Text

**File**: `src/test-ab-runner.ts`  
**Location**: Line 168

Change from:

```typescript
"  --category <name>    Filter by category: code, writing, system-design, data-analysis, simple, edge",
```

To:

```typescript
"  --category <name>    Filter by category: code, writing, system-design, data-analysis, complex, edge",
```

---

### Test Case Changes Summary

| Change                 | Before                                                    | After                                                      |
| ---------------------- | --------------------------------------------------------- | ---------------------------------------------------------- |
| Total quick test cases | 12                                                        | 13                                                         |
| Categories             | code, writing, system-design, data-analysis, simple, edge | code, writing, system-design, data-analysis, complex, edge |
| Removed                | 3 "simple" cases                                          | -                                                          |
| Added                  | -                                                         | 4 "complex" cases                                          |

**Why the new "complex" category is valuable:**

1. **complex-001**: Multi-constraint migration - tests constraint handling and phased planning
2. **complex-002**: Multi-format output - tests output structure requirements
3. **complex-003**: Domain-specific schema - tests technical depth with business context
4. **complex-004**: Debugging task - tests hypothesis generation with incomplete info

---

## Verification Steps

After implementation:

1. **Lint check**: `npm run lint`
2. **Build check**: `npm run build`
3. **Dry run test**:
   ```bash
   npx ts-node src/test-ab-runner.ts \
     --baseline src/prompts/v1-baseline.ts \
     --candidate src/prompts/v2-lean.ts \
     --dry-run \
     --mode quick
   ```
4. **Judge comparison test** (verify optimization runs once):

   ```bash
   npx ts-node src/test-ab-runner.ts \
     --baseline src/prompts/v1-baseline.ts \
     --candidate src/prompts/v2-lean.ts \
     --compare-judges \
     --mode quick \
     --category complex
   ```

   - Should see "Pre-optimizing X test cases..." appear **once**
   - Should see "Evaluating with judge: X..." appear **3 times**

5. **Category filter test**:

   ```bash
   npx ts-node src/test-ab-runner.ts \
     --baseline src/prompts/v1-baseline.ts \
     --candidate src/prompts/v2-lean.ts \
     --dry-run \
     --category complex
   ```

   - Should show 4 test cases

---

## File Change Summary

| File                                | Changes                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `src/test-ab-runner.ts`             | Add interface, 2 new functions, refactor runJudgeComparison, update help text |
| `src/test-data/test-cases-quick.ts` | Remove 3 simple cases, add 4 complex cases                                    |

---

## Execution Checklist

- [ ] Step 1.1: Add `CachedOptimization` interface
- [ ] Step 1.2: Add `TimingData` import
- [ ] Step 1.3: Add `optimizeAllTestCases()` and `evaluateCachedTestCase()` functions
- [ ] Step 1.4: Replace `runJudgeComparison()` function
- [ ] Step 2.1: Remove 3 "simple" test cases
- [ ] Step 2.2: Add 4 "complex" test cases
- [ ] Step 2.3: Update CLI help text
- [ ] Run `npm run lint`
- [ ] Run `npm run build`
- [ ] Test with `--compare-judges --category complex`

---

## Validation Notes (2025-12-28)

### Code Review Findings

**Verified correct:**

- `runJudgeComparison()` at lines 403-515 calls `runTestCase()` per judge → redundant optimizations confirmed
- `runTestCase` is aliased to `runTestCaseV3` (line 351)
- `pLimit` already imported (line 19)
- `pearsonCorrelation()` exists (line 390)
- `JudgeComparisonResult` interface exists (line 383)

**Step 1.2 (TimingData import) - REQUIRED:**

- `TimingData` is re-exported from `./utils/evaluator` but NOT currently imported in `test-ab-runner.ts`
- New code in Step 1.3 uses `TimingData` in the codex path (lines 132, 147)

**Step 1.4 safety checks - ALREADY INCLUDED:**

- Plan already includes division-by-zero guards:
  ```typescript
  jr.scores.baseline.length > 0 ? ... : 0
  ```
- Agreement rate calculation already uses `minLen` guard

### Risk Assessment

- **Low Risk**: Changes are additive and backward-compatible
- **Rollback**: Easy via git revert if issues found

### Final Status: ✅ APPROVED FOR IMPLEMENTATION
