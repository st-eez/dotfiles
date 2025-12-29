#!/usr/bin/env npx ts-node
/**
 * A/B Test Runner for Prompt Strategies
 *
 * CLI Usage:
 *   npx ts-node src/test-ab-runner.ts \
 *     --baseline src/prompts/v1-baseline.ts \
 *     --candidate src/prompts/v2-experiment.ts \
 *     [--dry-run] \
 *     [--skip-context-check] \
 *     [--concurrency 5] \
 *     [--mode quick|detailed] \
 *     [--category code|writing|...]
 */

import "./setup-test";
import * as fs from "fs";
import * as path from "path";
import pLimit from "p-limit";
import { TEST_CASES, TestCase, getTestCasesByMode } from "./test-data/test-cases";
import {
  EvaluationResultV3,
  evaluateWithMetadata,
  OptimizationMetadata,
  TimingData,
  JUDGES,
  JudgeConfig,
  JudgeId,
} from "./utils/evaluator";
import { decideWinner, EnhancedSummary, buildEnhancedSummary } from "./utils/statistics";
import { runWithEngine, withRetry, LLMRunOptions, runGeminiWithMetadata, GeminiRunResult } from "./test/lib/test-utils";
import { PromptStrategy } from "./prompts/types";
import { analyzeResults, BatchAnalysisResult } from "./test/lib/analysis";

// --- Types ---

interface BenchmarkReportV3 {
  schemaVersion: "3.0";
  timestamp: string;
  baselineVersion: string;
  candidateVersion: string;
  testCaseCount: number;
  concurrency: number;
  durationSeconds: number;
  mode?: "quick" | "detailed";
  category?: string;
  engine: "gemini" | "codex";
  model: string;
  judge: {
    engine: "codex" | "gemini" | "opencode";
    model: string;
    reasoningEffort?: string;
  };
  results: {
    testCaseId: string;
    baseline: EvaluationResultV3;
    candidate: EvaluationResultV3;
  }[];
  summary: EnhancedSummary;
  gateFailures: {
    baseline: { testCaseId: string; gate: "structure" | "context" }[];
    candidate: { testCaseId: string; gate: "structure" | "context" }[];
  };
  failures: {
    testCaseId: string;
    version: "baseline" | "candidate";
    error: string;
  }[];
  analysis: BatchAnalysisResult;
}

type BenchmarkReport = BenchmarkReportV3;

interface CachedOptimization {
  testCaseId: string;
  baselineOutput: string;
  candidateOutput: string;
  baselineMeta: OptimizationMetadata;
  candidateMeta: OptimizationMetadata;
}

interface CLIArgs {
  baseline: string;
  candidate: string;
  dryRun: boolean;
  concurrency: number;
  engine: "gemini" | "codex";
  model?: string;
  reasoning: "high" | "medium" | "low";
  mode?: "quick" | "detailed";
  category?: string;
  judge: JudgeId;
  compareJudges: boolean;
}

// --- CLI Argument Parsing ---

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const result: CLIArgs = {
    baseline: "",
    candidate: "",
    dryRun: false,
    concurrency: 5,
    engine: "gemini",
    model: undefined,
    reasoning: "high",
    mode: undefined,
    category: undefined,
    judge: "codex-high",
    compareJudges: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--baseline":
        result.baseline = args[++i] || "";
        break;
      case "--candidate":
        result.candidate = args[++i] || "";
        break;
      case "--dry-run":
        result.dryRun = true;
        break;
      case "--concurrency":
        result.concurrency = Math.min(parseInt(args[++i] || "5", 10), 8);
        break;
      case "--engine": {
        const engineArg = args[++i];
        if (engineArg === "gemini" || engineArg === "codex") {
          result.engine = engineArg;
        }
        break;
      }
      case "--model":
        result.model = args[++i];
        break;
      case "--reasoning": {
        const reasoningArg = args[++i] as "high" | "medium" | "low";
        if (["high", "medium", "low"].includes(reasoningArg)) {
          result.reasoning = reasoningArg;
        }
        break;
      }
      case "--mode": {
        const modeArg = args[++i];
        if (modeArg === "quick" || modeArg === "detailed") {
          result.mode = modeArg;
        }
        break;
      }
      case "--category":
        result.category = args[++i];
        break;
      case "--judge": {
        const judgeArg = args[++i] as JudgeId;
        if (judgeArg in JUDGES) {
          result.judge = judgeArg;
        } else {
          console.error(`Unknown judge: ${judgeArg}. Valid options: ${Object.keys(JUDGES).join(", ")}`);
          process.exit(1);
        }
        break;
      }
      case "--compare-judges":
        result.compareJudges = true;
        break;
      default:
        if (arg.startsWith("--")) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  if (!result.baseline || !result.candidate) {
    console.error("Usage: npx ts-node src/test-ab-runner.ts --baseline <path> --candidate <path> [options]");
    console.error("Options:");
    console.error("  --dry-run            Print prompts and cost estimate without API calls");
    console.error("  --concurrency <n>    Parallel API calls (default: 5, max: 8)");
    console.error("  --engine <name>      LLM engine: gemini or codex (default: gemini)");
    console.error("  --model <name>       Model override (default: engine-specific)");
    console.error("  --reasoning <level>  Codex reasoning effort: high, medium, low (default: high)");
    console.error("  --mode <mode>        Filter test cases: quick or detailed");
    console.error(
      "  --category <name>    Filter by category: code, writing, system-design, data-analysis, complex, edge",
    );
    console.error(`  --judge <name>       Judge to use: ${Object.keys(JUDGES).join(", ")} (default: codex-high)`);
    console.error("  --compare-judges     Run with all judges and compare results");
    process.exit(1);
  }

  return result;
}

// --- Strategy Loading ---

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

// --- Prompt Generation ---

function generatePrompt(strategy: PromptStrategy, testCase: TestCase): string {
  if (testCase.mode === "quick") {
    return strategy.buildQuickPrompt(testCase.userRequest, testCase.additionalContext, testCase.persona);
  } else {
    return strategy.buildDetailedPrompt(testCase.userRequest, testCase.additionalContext, testCase.persona);
  }
}

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
  reasoning: "high" | "medium" | "low" = "high",
): Promise<Map<string, CachedOptimization>> {
  const cache = new Map<string, CachedOptimization>();

  const modelName = model || (engine === "gemini" ? "gemini-3-flash-preview" : "gpt-5.2-codex");
  const reasoningInfo = engine === "codex" ? ` (reasoning: ${reasoning})` : "";
  console.log(`\n📦 Pre-optimizing ${testCases.length} test cases with ${engine}/${modelName}${reasoningInfo}...`);

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

  for (let index = 0; index < testCases.length; index++) {
    const testCase = testCases[index];
    const baselinePrompt = generatePrompt(baseline, testCase);
    const candidatePrompt = generatePrompt(candidate, testCase);

    process.stdout.write(`  [${index + 1}/${testCases.length}] ${testCase.id}`);

    if (engine === "gemini") {
      const t1 = Date.now();
      const [baselineResult, candidateResult] = await Promise.all([
        runGeminiWithMetadata(baselinePrompt, { model }),
        runGeminiWithMetadata(candidatePrompt, { model }),
      ]);
      const optTime = ((Date.now() - t1) / 1000).toFixed(1);
      const bIn = (baselinePrompt.length / 1000).toFixed(1);
      const bOut = (baselineResult.response.length / 1000).toFixed(1);
      const cIn = (candidatePrompt.length / 1000).toFixed(1);
      const cOut = (candidateResult.response.length / 1000).toFixed(1);
      console.log(` → ${optTime}s (B:${bIn}k→${bOut}k, C:${cIn}k→${cOut}k)`);

      cache.set(testCase.id, {
        testCaseId: testCase.id,
        baselineOutput: baselineResult.response,
        candidateOutput: candidateResult.response,
        baselineMeta: buildMeta(baselineResult, baselinePrompt),
        candidateMeta: buildMeta(candidateResult, candidatePrompt),
      });
    } else {
      const runWithTiming = async (
        prompt: string,
        label: string,
      ): Promise<{ output: string; timing: TimingData; label: string }> => {
        const startMs = Date.now();
        const output = await withRetry(() => runWithEngine(engine, prompt, { model, reasoningEffort: reasoning }));
        const endMs = Date.now();
        return { output, timing: { startMs, endMs, durationMs: endMs - startMs }, label };
      };

      const t1 = Date.now();
      const [baselineRun, candidateRun] = await Promise.all([
        runWithTiming(baselinePrompt, "B"),
        runWithTiming(candidatePrompt, "C"),
      ]);
      const optTime = ((Date.now() - t1) / 1000).toFixed(1);
      const bTime = (baselineRun.timing.durationMs / 1000).toFixed(1);
      const cTime = (candidateRun.timing.durationMs / 1000).toFixed(1);
      const bIn = (baselinePrompt.length / 1000).toFixed(1);
      const bOut = (baselineRun.output.length / 1000).toFixed(1);
      const cIn = (candidatePrompt.length / 1000).toFixed(1);
      const cOut = (candidateRun.output.length / 1000).toFixed(1);
      console.log(` → ${optTime}s (B:${bIn}k→${bOut}k ${bTime}s, C:${cIn}k→${cOut}k ${cTime}s)`);

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
  }

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

// --- Dry Run ---

function handleDryRun(baseline: PromptStrategy, candidate: PromptStrategy, testCases: TestCase[]): void {
  const testCaseCount = testCases.length;
  const apiCalls = testCaseCount * 2 * 2;
  const estimatedTokens = apiCalls * 2000;
  const estimatedCost = (estimatedTokens / 1_000_000) * 0.075;

  console.log("\n📊 DRY RUN - Cost Estimate");
  console.log("─".repeat(50));
  console.log(`Test cases: ${testCaseCount}`);
  console.log(`API calls: ${apiCalls}`);
  console.log(`Estimated tokens: ~${estimatedTokens.toLocaleString()}`);
  console.log(`Estimated cost: ~$${estimatedCost.toFixed(3)}`);
  console.log("");
  console.log(`Baseline: ${baseline.id} - ${baseline.name}`);
  console.log(`Candidate: ${candidate.id} - ${candidate.name}`);
  console.log("");
  console.log("📝 Sample Prompt (first test case, baseline):");
  console.log("─".repeat(50));
  const samplePrompt = generatePrompt(baseline, testCases[0]);
  console.log(samplePrompt.slice(0, 1500) + (samplePrompt.length > 1500 ? "\n... [truncated]" : ""));
}

// --- Test Case Execution ---

async function runTestCaseV3(
  testCase: TestCase,
  baseline: PromptStrategy,
  candidate: PromptStrategy,
  engine: "gemini" | "codex" = "gemini",
  model?: string,
  judge: JudgeConfig = JUDGES["codex-high"],
): Promise<{ baseline: EvaluationResultV3; candidate: EvaluationResultV3 }> {
  const baselinePrompt = generatePrompt(baseline, testCase);
  const candidatePrompt = generatePrompt(candidate, testCase);

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
    const retries = baselineResult.retry.attempts + candidateResult.retry.attempts - 2;
    const retryInfo = retries > 0 ? ` +${retries}retry` : "";
    process.stdout.write(` opt:${optTime}s${retryInfo}`);

    const t2 = Date.now();
    const [baselineEval, candidateEval] = await Promise.all([
      evaluateWithMetadata(
        testCase.id,
        baseline.id,
        testCase.userRequest,
        testCase.additionalContext,
        baselineResult.response,
        buildMeta(baselineResult, baselinePrompt),
        judge,
      ),
      evaluateWithMetadata(
        testCase.id,
        candidate.id,
        testCase.userRequest,
        testCase.additionalContext,
        candidateResult.response,
        buildMeta(candidateResult, candidatePrompt),
        judge,
      ),
    ]);
    const evalTime = ((Date.now() - t2) / 1000).toFixed(1);
    process.stdout.write(` eval:${evalTime}s`);

    return { baseline: baselineEval, candidate: candidateEval };
  } else {
    const options: LLMRunOptions = { model };

    const runWithTiming = async (
      prompt: string,
    ): Promise<{ output: string; timing: { startMs: number; endMs: number; durationMs: number } }> => {
      const startMs = Date.now();
      const output = await withRetry(() => runWithEngine(engine, prompt, options));
      const endMs = Date.now();
      return { output, timing: { startMs, endMs, durationMs: endMs - startMs } };
    };

    const [baselineRun, candidateRun] = await Promise.all([
      runWithTiming(baselinePrompt),
      runWithTiming(candidatePrompt),
    ]);

    const codexMeta = (
      prompt: string,
      run: { output: string; timing: { startMs: number; endMs: number; durationMs: number } },
    ): OptimizationMetadata => ({
      timing: run.timing,
      retry: { attempts: 1, totalRetryDelayMs: 0, failedAttempts: [] },
      tokens: null,
      promptCharCount: prompt.length,
      outputCharCount: run.output.length,
    });

    const [baselineEval, candidateEval] = await Promise.all([
      evaluateWithMetadata(
        testCase.id,
        baseline.id,
        testCase.userRequest,
        testCase.additionalContext,
        baselineRun.output,
        codexMeta(baselinePrompt, baselineRun),
        judge,
      ),
      evaluateWithMetadata(
        testCase.id,
        candidate.id,
        testCase.userRequest,
        testCase.additionalContext,
        candidateRun.output,
        codexMeta(candidatePrompt, candidateRun),
        judge,
      ),
    ]);

    return { baseline: baselineEval, candidate: candidateEval };
  }
}

const runTestCase = runTestCaseV3;

function printCategoryBreakdown(
  results: Array<{ testCaseId: string; baseline: EvaluationResultV3; candidate: EvaluationResultV3 }>,
  testCases: TestCase[],
): void {
  const byCategory = new Map<string, { baseline: number[]; candidate: number[] }>();

  for (const r of results) {
    const tc = testCases.find((t) => t.id === r.testCaseId);
    if (!tc) continue;

    if (!byCategory.has(tc.category)) {
      byCategory.set(tc.category, { baseline: [], candidate: [] });
    }
    byCategory.get(tc.category)!.baseline.push(r.baseline.totalScore);
    byCategory.get(tc.category)!.candidate.push(r.candidate.totalScore);
  }

  console.log("\n📊 Category Breakdown:");
  for (const [cat, scores] of byCategory) {
    const bAvg = scores.baseline.reduce((a, b) => a + b, 0) / scores.baseline.length;
    const cAvg = scores.candidate.reduce((a, b) => a + b, 0) / scores.candidate.length;
    const delta = cAvg - bAvg;
    console.log(
      `   ${cat}: baseline=${bAvg.toFixed(2)}, candidate=${cAvg.toFixed(2)}, Δ=${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`,
    );
  }
}

// --- Judge Comparison ---

interface JudgeComparisonResult {
  judgeId: JudgeId;
  scores: { baseline: number[]; candidate: number[] };
  decisions: Array<"baseline" | "candidate" | "tie">;
  latencyMs: number[];
}

function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const sumY2 = y.reduce((a, b) => a + b * b, 0);
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  return denominator === 0 ? 0 : numerator / denominator;
}

async function runJudgeComparison(
  testCases: TestCase[],
  baseline: PromptStrategy,
  candidate: PromptStrategy,
  engine: "gemini" | "codex",
  model: string | undefined,
  reasoning: "high" | "medium" | "low",
): Promise<void> {
  const judgeIds: JudgeId[] = ["codex-medium", "gemini-flash", "grok-code"];
  const judgeResults: JudgeComparisonResult[] = [];

  console.log("\n⚖️  JUDGE COMPARISON MODE");
  console.log("═".repeat(50));
  console.log(`Running ${testCases.length} test cases with ${judgeIds.length} judges...`);

  // PHASE 1: Pre-optimize all test cases ONCE
  const optimizationCache = await optimizeAllTestCases(testCases, baseline, candidate, engine, model, reasoning);

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
        const elapsed = Date.now() - startMs;
        latencyMs.push(elapsed);

        scores.baseline.push(result.baseline.totalScore);
        scores.candidate.push(result.candidate.totalScore);

        const winner =
          result.candidate.totalScore > result.baseline.totalScore
            ? "candidate"
            : result.baseline.totalScore > result.candidate.totalScore
              ? "baseline"
              : "tie";
        decisions.push(winner);

        const elapsedSec = (elapsed / 1000).toFixed(1);
        console.log(
          ` → B:${result.baseline.totalScore.toFixed(1)} C:${result.candidate.totalScore.toFixed(1)} (${winner}) [${elapsedSec}s]`,
        );
      } catch (error) {
        const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
        const msg = error instanceof Error ? error.message : String(error);
        console.log(` ✗ ${msg.slice(0, 60)} [${elapsed}s]`);
      }
    }

    judgeResults.push({ judgeId, scores, decisions, latencyMs });
  }

  console.log("\n" + "═".repeat(50));
  console.log("📊 JUDGE COMPARISON RESULTS");
  console.log("═".repeat(50));

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

  console.log("\n💰 Estimated Cost (per 1000 evaluations):");
  console.log("  codex-high:   ~$15.00 (high reasoning)");
  console.log("  codex-medium: ~$10.00 (medium reasoning)");
  console.log("  gemini-flash: ~$0.75  (flash tier)");
}

// --- Main ---

async function main(): Promise<void> {
  const startTime = Date.now();
  const args = parseArgs();

  console.log("🧪 A/B Test Runner for Prompt Strategies\n");
  console.log("─".repeat(50));

  // Load strategies
  console.log("\n📦 Loading strategies...");
  let baseline: PromptStrategy;
  let candidate: PromptStrategy;

  try {
    baseline = await loadStrategy(args.baseline);
    console.log(`  ✅ Baseline: ${baseline.id} - ${baseline.name}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Failed to load baseline: ${msg}`);
    process.exit(1);
  }

  try {
    candidate = await loadStrategy(args.candidate);
    console.log(`  ✅ Candidate: ${candidate.id} - ${candidate.name}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Failed to load candidate: ${msg}`);
    process.exit(1);
  }

  // Filter test cases
  let testCases = args.mode ? getTestCasesByMode(args.mode) : TEST_CASES;
  if (args.category) {
    testCases = testCases.filter((tc) => tc.category === args.category);
  }

  const total = testCases.length;

  if (total === 0) {
    console.error(`\n❌ No test cases found for mode=${args.mode || "all"}, category=${args.category || "all"}`);
    process.exit(1);
  }

  if (args.dryRun) {
    handleDryRun(baseline, candidate, testCases);
    process.exit(0);
  }

  if (args.compareJudges) {
    await runJudgeComparison(testCases, baseline, candidate, args.engine, args.model, args.reasoning);
    process.exit(0);
  }

  // Execution phase
  console.log(`\n🚀 Running A/B test (concurrency: ${args.concurrency}, test cases: ${total})...`);

  const limit = pLimit(args.concurrency);
  const results: Array<{ testCaseId: string; baseline: EvaluationResultV3; candidate: EvaluationResultV3 }> = [];
  const gateFailures: BenchmarkReport["gateFailures"] = { baseline: [], candidate: [] };
  const failures: BenchmarkReport["failures"] = [];

  let completed = 0;

  const promises = testCases.map((testCase, index) =>
    limit(async () => {
      try {
        const staggerDelay = index * 500;
        if (staggerDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, staggerDelay));
        }
        const result = await runTestCase(testCase, baseline, candidate, args.engine, args.model, JUDGES[args.judge]);
        results.push({
          testCaseId: testCase.id,
          baseline: result.baseline,
          candidate: result.candidate,
        });

        if (!result.baseline.structurePass) {
          gateFailures.baseline.push({ testCaseId: testCase.id, gate: "structure" });
        }
        if (!result.baseline.contextPass) {
          gateFailures.baseline.push({ testCaseId: testCase.id, gate: "context" });
        }
        if (!result.candidate.structurePass) {
          gateFailures.candidate.push({ testCaseId: testCase.id, gate: "structure" });
        }
        if (!result.candidate.contextPass) {
          gateFailures.candidate.push({ testCaseId: testCase.id, gate: "context" });
        }

        completed++;
        process.stdout.write(`\r  Progress: ${completed}/${total}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`\n  ❌ ${testCase.id} failed: ${msg}`);
        failures.push({
          testCaseId: testCase.id,
          version: "baseline",
          error: msg,
        });
      }
    }),
  );

  await Promise.all(promises);
  console.log("\n");

  // Analysis phase
  console.log("📈 Analyzing results...");

  const baselineScores = results.map((r) => r.baseline.totalScore);
  const candidateScores = results.map((r) => r.candidate.totalScore);

  const { decision } = decideWinner(baselineScores, candidateScores);

  // Committee role analysis
  const candidateSyntheses = results.map((r) => ({
    testCaseId: r.testCaseId,
    synthesis: r.candidate.synthesis,
  }));
  const analysis = analyzeResults(candidateSyntheses);

  if (analysis.committeeCount > 0) {
    console.log(`\n⚠️  Committee-style roles detected in ${analysis.committeeCount} test cases:`);
    console.log(`   ${analysis.flagged.join(", ")}`);
  }

  printCategoryBreakdown(results, testCases);

  const durationSeconds = (Date.now() - startTime) / 1000;

  // Build report
  const judgeConfig = JUDGES[args.judge];
  const report: BenchmarkReport = {
    schemaVersion: "3.0",
    timestamp: new Date().toISOString(),
    baselineVersion: baseline.id,
    candidateVersion: candidate.id,
    testCaseCount: testCases.length,
    concurrency: args.concurrency,
    durationSeconds,
    mode: args.mode,
    category: args.category,
    engine: args.engine,
    model: args.model || (args.engine === "gemini" ? "gemini-3-flash-preview" : "gpt-5.2-codex"),
    judge: {
      engine: judgeConfig.engine,
      model: judgeConfig.model,
      ...("reasoningEffort" in judgeConfig ? { reasoningEffort: judgeConfig.reasoningEffort } : {}),
    },
    results,
    summary: buildEnhancedSummary(results, baselineScores, candidateScores),
    gateFailures,
    failures,
    analysis,
  };

  // Save report with timestamp
  const reportDir = path.join(process.cwd(), "ab_results");
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(reportDir, `ab_test_results_${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: ${reportPath}`);

  // Print summary
  console.log("\n" + "═".repeat(50));
  console.log("📊 SUMMARY");
  console.log("═".repeat(50));
  console.log(`Duration: ${durationSeconds.toFixed(1)}s`);
  console.log(`Test cases: ${report.testCaseCount}`);
  console.log(`Engine: ${report.engine} (${report.model})`);
  console.log(
    `Judge: ${args.judge} (${report.judge.engine}/${report.judge.model}${report.judge.reasoningEffort ? `/${report.judge.reasoningEffort}` : ""})`,
  );
  if (args.mode) console.log(`Mode filter: ${args.mode}`);
  if (args.category) console.log(`Category filter: ${args.category}`);
  console.log("");
  console.log(`Baseline (${baseline.id}):  avg score = ${report.summary.baselineAvgScore.toFixed(2)}`);
  console.log(`Candidate (${candidate.id}): avg score = ${report.summary.candidateAvgScore.toFixed(2)}`);
  console.log("");
  console.log(
    `Improvement: ${report.summary.improvement >= 0 ? "+" : ""}${report.summary.improvement.toFixed(2)} points`,
  );
  console.log(`p-value: ${report.summary.pValue.toFixed(4)}`);
  console.log(`Significant: ${report.summary.significant ? "YES" : "NO"}`);

  console.log("\n📈 HYPOTHESIS VALIDATION");
  console.log("─".repeat(50));
  console.log(`Token Reduction: ${report.summary.tokens.tokenReductionPct.toFixed(1)}% (target: 40-50%)`);
  console.log(`Latency Reduction: ${report.summary.timing.latencyReductionPct.toFixed(1)}% (target: 30-40%)`);
  console.log(
    `Quality Impact: ${report.summary.improvement >= 0 ? "+" : ""}${report.summary.improvement.toFixed(2)} points`,
  );
  console.log("");
  console.log(
    `Timing: baseline=${report.summary.timing.baselineMedianMs.toFixed(0)}ms, candidate=${report.summary.timing.candidateMedianMs.toFixed(0)}ms (median)`,
  );
  console.log(
    `Tokens: baseline=${report.summary.tokens.baselineMedian.toFixed(0)}, candidate=${report.summary.tokens.candidateMedian.toFixed(0)} (median input)`,
  );

  if (report.summary.srmCheck.hasSRM) {
    console.log(
      `\n⚠️  SRM DETECTED: Ratio=${report.summary.srmCheck.observedRatio.toFixed(2)}, p=${report.summary.srmCheck.pValue.toFixed(4)}`,
    );
  }
  console.log("");

  // Gate failures
  if (gateFailures.baseline.length > 0 || gateFailures.candidate.length > 0) {
    console.log("⚠️  Gate Failures:");
    if (gateFailures.baseline.length > 0) {
      console.log(`   Baseline: ${gateFailures.baseline.map((f) => `${f.testCaseId}(${f.gate})`).join(", ")}`);
    }
    if (gateFailures.candidate.length > 0) {
      console.log(`   Candidate: ${gateFailures.candidate.map((f) => `${f.testCaseId}(${f.gate})`).join(", ")}`);
    }
    console.log("");
  }

  // Execution failures
  if (failures.length > 0) {
    console.log(`❌ Execution Failures: ${failures.length}`);
    for (const f of failures) {
      console.log(`   ${f.testCaseId}: ${f.error.slice(0, 80)}`);
    }
    console.log("");
  }

  // Analysis
  if (analysis.committeeCount > 0) {
    console.log(`🔍 Analysis: ${analysis.committeeCount}/${analysis.total} outputs have committee-style roles`);
    console.log("");
  }

  // Decision
  const decisionEmoji = decision === "ship_candidate" ? "🚀" : decision === "keep_baseline" ? "📌" : "🤔";
  console.log(`${decisionEmoji} DECISION: ${decision.toUpperCase().replace(/_/g, " ")}`);

  if (decision === "ship_candidate") {
    console.log(`\nTo promote candidate, update engines.ts import:`);
    console.log(
      `  import { buildQuickPrompt, buildDetailedPrompt } from '../prompts/${path.basename(args.candidate, ".ts")}';`,
    );
  }

  console.log("");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
