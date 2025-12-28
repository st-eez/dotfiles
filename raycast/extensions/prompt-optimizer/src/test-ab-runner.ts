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
import { evaluate, EvaluationResult } from "./utils/evaluator";
import { decideWinner, Decision } from "./utils/statistics";
import { safeExec } from "./utils/exec";
import { runWithEngine, withRetry, LLMRunOptions } from "./test/lib/test-utils";
import { PromptStrategy } from "./prompts/types";
import { analyzeResults, BatchAnalysisResult } from "./test/lib/analysis";

// --- Types ---

interface BenchmarkReport {
  schemaVersion: "2.0";
  timestamp: string;
  baselineVersion: string;
  candidateVersion: string;
  testCaseCount: number;
  concurrency: number;
  durationSeconds: number;
  mode?: "quick" | "detailed";
  category?: string;
  results: {
    testCaseId: string;
    baseline: EvaluationResult;
    candidate: EvaluationResult;
  }[];
  summary: {
    baselineAvgScore: number;
    candidateAvgScore: number;
    improvement: number;
    pValue: number;
    significant: boolean;
    decision: Decision;
  };
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

interface CLIArgs {
  baseline: string;
  candidate: string;
  dryRun: boolean;
  skipContextCheck: boolean;
  concurrency: number;
  engine: "gemini" | "codex";
  model?: string;
  mode?: "quick" | "detailed";
  category?: string;
}

// --- CLI Argument Parsing ---

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const result: CLIArgs = {
    baseline: "",
    candidate: "",
    dryRun: false,
    skipContextCheck: false,
    concurrency: 5,
    engine: "gemini",
    model: undefined,
    mode: undefined,
    category: undefined,
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
      case "--skip-context-check":
        result.skipContextCheck = true;
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
    console.error("  --skip-context-check Skip context preservation validation");
    console.error("  --concurrency <n>    Parallel API calls (default: 5, max: 8)");
    console.error("  --engine <name>      LLM engine: gemini or codex (default: gemini)");
    console.error("  --model <name>       Model override (default: engine-specific)");
    console.error("  --mode <mode>        Filter test cases: quick or detailed");
    console.error(
      "  --category <name>    Filter by category: code, writing, system-design, data-analysis, simple, edge",
    );
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

// --- Context Check ---

async function runContextCheck(strategyPath: string): Promise<boolean> {
  console.log(`  Running context preservation check for ${path.basename(strategyPath)}...`);
  try {
    await safeExec("npx", ["ts-node", "src/test-context-preservation.ts", strategyPath], undefined, 300_000);
    console.log("  ✅ Context check passed");
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Context check failed: ${msg}`);
    return false;
  }
}

// --- Prompt Generation ---

function generatePrompt(strategy: PromptStrategy, testCase: TestCase): string {
  if (testCase.mode === "quick") {
    return strategy.buildQuickPrompt(testCase.userRequest, testCase.additionalContext, testCase.persona);
  } else {
    return strategy.buildDetailedPrompt(testCase.userRequest, testCase.additionalContext, testCase.persona);
  }
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

async function runTestCase(
  testCase: TestCase,
  baseline: PromptStrategy,
  candidate: PromptStrategy,
  engine: "gemini" | "codex" = "gemini",
  model?: string,
): Promise<{ baseline: EvaluationResult; candidate: EvaluationResult }> {
  const baselinePrompt = generatePrompt(baseline, testCase);
  const candidatePrompt = generatePrompt(candidate, testCase);

  const options: LLMRunOptions = { model };

  const runOptimization = async (prompt: string): Promise<string> => {
    return withRetry(() => runWithEngine(engine, prompt, options));
  };

  const [baselineOutput, candidateOutput] = await Promise.all([
    runOptimization(baselinePrompt),
    runOptimization(candidatePrompt),
  ]);

  const [baselineEval, candidateEval] = await Promise.all([
    evaluate(testCase.id, baseline.id, testCase.userRequest, testCase.additionalContext, baselineOutput),
    evaluate(testCase.id, candidate.id, testCase.userRequest, testCase.additionalContext, candidateOutput),
  ]);

  return { baseline: baselineEval, candidate: candidateEval };
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

  // Context preservation check
  if (!args.skipContextCheck) {
    console.log("\n🔍 Validating context preservation...");
    const baselinePass = await runContextCheck(args.baseline);
    const candidatePass = await runContextCheck(args.candidate);

    if (!baselinePass || !candidatePass) {
      console.error("\n❌ Aborting: Context preservation check failed");
      process.exit(1);
    }
  } else {
    console.log("\n⚠️  Skipping context preservation check (--skip-context-check)");
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

  // Dry run mode
  if (args.dryRun) {
    handleDryRun(baseline, candidate, testCases);
    process.exit(0);
  }

  // Execution phase
  console.log(`\n🚀 Running A/B test (concurrency: ${args.concurrency}, test cases: ${total})...`);

  const limit = pLimit(args.concurrency);
  const results: Array<{ testCaseId: string; baseline: EvaluationResult; candidate: EvaluationResult }> = [];
  const gateFailures: BenchmarkReport["gateFailures"] = { baseline: [], candidate: [] };
  const failures: BenchmarkReport["failures"] = [];

  let completed = 0;

  const promises = testCases.map((testCase) =>
    limit(async () => {
      try {
        const result = await runTestCase(testCase, baseline, candidate, args.engine, args.model);
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

  const { decision, stats } = decideWinner(baselineScores, candidateScores);

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

  const durationSeconds = (Date.now() - startTime) / 1000;

  // Build report
  const report: BenchmarkReport = {
    schemaVersion: "2.0",
    timestamp: new Date().toISOString(),
    baselineVersion: baseline.id,
    candidateVersion: candidate.id,
    testCaseCount: testCases.length,
    concurrency: args.concurrency,
    durationSeconds,
    mode: args.mode,
    category: args.category,
    results,
    summary: {
      baselineAvgScore: stats.baselineAvg,
      candidateAvgScore: stats.candidateAvg,
      improvement: stats.improvement,
      pValue: stats.pValue,
      significant: stats.significant,
      decision,
    },
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
  if (args.mode) console.log(`Mode filter: ${args.mode}`);
  if (args.category) console.log(`Category filter: ${args.category}`);
  console.log("");
  console.log(`Baseline (${baseline.id}):  avg score = ${stats.baselineAvg.toFixed(2)}`);
  console.log(`Candidate (${candidate.id}): avg score = ${stats.candidateAvg.toFixed(2)}`);
  console.log("");
  console.log(`Improvement: ${stats.improvement >= 0 ? "+" : ""}${stats.improvement.toFixed(2)} points`);
  console.log(`p-value: ${stats.pValue.toFixed(4)}`);
  console.log(`Significant: ${stats.significant ? "YES" : "NO"}`);
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
