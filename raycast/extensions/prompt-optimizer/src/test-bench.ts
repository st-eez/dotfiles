#!/usr/bin/env npx ts-node
import "./setup-test";
import * as fs from "fs";
import * as path from "path";
import * as p from "@clack/prompts";
import color from "picocolors";
import pLimit from "p-limit";
import { TEST_CASES, TestCase } from "./test-data/test-cases";
import { CacheManager, CachedOptimizationEntry, CachedOptimizationRun } from "./utils/cache";
import {
  evaluateWithMetadata,
  validateStructureLocally,
  JUDGES,
  JudgeId,
  JudgeConfig,
  EvaluationResultV3,
} from "./utils/evaluator";
import { PromptStrategy } from "./prompts/types";
import { runGeminiWithMetadata, runWithEngine, withRetry, GeminiRunResult } from "./test/lib/test-utils";
import { OptimizationMetadata, TimingData } from "./utils/types";

type Command = "validate" | "optimize" | "judge" | "cache" | "compare" | "ab";
type CacheSubcommand = "status" | "clear";
type EngineType = "gemini" | "codex";

interface TestBenchArgs {
  command: Command;
  cacheSubcommand?: CacheSubcommand;
  strategy?: string;
  cases?: string[];
  mode?: "quick" | "detailed";
  category?: string;
  engine?: EngineType;
  model?: string;
  reasoning?: "high" | "medium" | "low";
  judge?: JudgeId;
  force?: boolean;
  all?: boolean;
  runs?: [string, string];
  concurrency?: number;
  baselineRun?: string;
  candidateRun?: string;
}

const DEFAULT_ENGINE: EngineType = "gemini";
const DEFAULT_MODEL_GEMINI = "gemini-3-flash-preview";
const DEFAULT_MODEL_CODEX = "gpt-5.2-codex";
const SMOKE_TEST_CASES = ["code-001", "write-001", "edge-001"];
const CATEGORIES = [...new Set(TEST_CASES.map((tc) => tc.category))];

interface StrategyInfo {
  path: string;
  id: string;
  name: string;
}

async function discoverStrategies(): Promise<StrategyInfo[]> {
  const promptsDir = path.join(process.cwd(), "src/prompts");
  const files = fs
    .readdirSync(promptsDir)
    .filter((f) => f.endsWith(".ts") && !["types.ts", "personas.ts", "smart.ts"].includes(f));

  const strategies: StrategyInfo[] = [];
  for (const file of files) {
    const filePath = path.join("src/prompts", file);
    try {
      const strategy = await loadStrategy(filePath);
      strategies.push({ path: filePath, id: strategy.id, name: strategy.name });
    } catch (_) {
      void _;
    }
  }
  return strategies;
}

function printUsage(): void {
  console.log(`
${color.bold("Test Bench - Prompt Optimization Testing Infrastructure")}

${color.cyan("Usage:")}
  npx ts-node src/test-bench.ts <command> [options]
  npx ts-node src/test-bench.ts                    (interactive mode)

${color.cyan("Commands:")}
  validate   Syntax check - verify strategy code runs without errors (FREE, no LLM)
  optimize   Run LLM to generate optimized prompts, cache results to disk
  judge      Score cached outputs using LLM-as-judge
  ab         A/B compare two cached optimization runs (costs $)
  cache      Manage disk cache (status/clear)
  compare    Diff two result files side-by-side

${color.cyan("Options:")}
  --strategy <path>    Strategy file path (e.g., src/prompts/v1-baseline.ts)
  --case <id>          Specific test case ID (can be repeated)
  --mode <mode>        Filter test cases: quick or detailed
  --category <name>    Filter by category: ${CATEGORIES.join(", ")}
  --engine <name>      Engine: gemini or codex (default: gemini)
  --model <name>       Model override
  --reasoning <level>  Codex reasoning: high, medium, low (default: high)
  --judge <name>       Judge: ${Object.keys(JUDGES).join(", ")}
  --force              Bypass cache and regenerate
  --all                Clear all cache entries
  --runs <f1> <f2>     Two result files to compare
  --concurrency <n>    Parallel API calls (default: 3, max: 10)
  --baseline <run>     Baseline cached run for A/B (e.g., v1-baseline_gemini_gemini-3-flash-preview)
  --candidate <run>    Candidate cached run for A/B comparison

${color.cyan("Examples:")}
  npx ts-node src/test-bench.ts validate --strategy src/prompts/v1-baseline.ts
  npx ts-node src/test-bench.ts optimize --strategy src/prompts/v1-baseline.ts --case code-001
  npx ts-node src/test-bench.ts judge --strategy src/prompts/v1-baseline.ts --judge gemini-flash
  npx ts-node src/test-bench.ts cache status
  npx ts-node src/test-bench.ts cache clear --strategy v1-baseline
  npx ts-node src/test-bench.ts ab --baseline v1-baseline_gemini_gemini-3-flash-preview --candidate v2-lean_codex_gpt-5.2-codex --judge codex-high
`);
}

function parseArgs(): TestBenchArgs | null {
  const args = process.argv.slice(2);

  if (args.length === 0) return null;
  if (args[0] === "--help" || args[0] === "-h") {
    printUsage();
    process.exit(0);
  }

  const command = args[0] as Command;
  if (!["validate", "optimize", "judge", "cache", "compare", "ab"].includes(command)) {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }

  const result: TestBenchArgs = { command };
  const cases: string[] = [];

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--strategy":
        result.strategy = args[++i];
        break;
      case "--case":
        cases.push(args[++i]);
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
      case "--judge": {
        const judgeArg = args[++i] as JudgeId;
        if (judgeArg in JUDGES) {
          result.judge = judgeArg;
        } else {
          console.error(`Unknown judge: ${judgeArg}. Valid: ${Object.keys(JUDGES).join(", ")}`);
          process.exit(1);
        }
        break;
      }
      case "--force":
        result.force = true;
        break;
      case "--all":
        result.all = true;
        break;
      case "--runs":
        result.runs = [args[++i], args[++i]];
        break;
      case "--concurrency": {
        const concurrency = parseInt(args[++i], 10);
        if (!isNaN(concurrency) && concurrency >= 1 && concurrency <= 10) {
          result.concurrency = concurrency;
        } else {
          console.warn("Concurrency must be 1-10, using default (3)");
        }
        break;
      }
      case "--baseline":
        result.baselineRun = args[++i];
        break;
      case "--candidate":
        result.candidateRun = args[++i];
        break;
      case "status":
      case "clear":
        if (command === "cache") {
          result.cacheSubcommand = arg as CacheSubcommand;
        }
        break;
      default:
        if (arg.startsWith("--")) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  if (cases.length > 0) result.cases = cases;
  return result;
}

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

function generatePrompt(strategy: PromptStrategy, testCase: TestCase): string {
  if (testCase.mode === "quick") {
    return strategy.buildQuickPrompt(testCase.userRequest, testCase.additionalContext, testCase.persona);
  } else {
    return strategy.buildDetailedPrompt(testCase.userRequest, testCase.additionalContext, testCase.persona);
  }
}

function filterTestCases(caseIds?: string[], mode?: "quick" | "detailed", category?: string): TestCase[] {
  let filtered = TEST_CASES;

  if (mode) {
    filtered = filtered.filter((tc) => tc.mode === mode);
  }

  if (category) {
    filtered = filtered.filter((tc) => tc.category === category);
  }

  if (caseIds && caseIds.length > 0) {
    filtered = filtered.filter((tc) => caseIds.includes(tc.id));
    const found = filtered.map((tc) => tc.id);
    const missing = caseIds.filter((id) => !found.includes(id));
    if (missing.length > 0) {
      console.warn(`Warning: Test cases not found: ${missing.join(", ")}`);
    }
  }

  return filtered;
}

function formatTable(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] || "").length)));

  const separator = "+" + colWidths.map((w) => "-".repeat(w + 2)).join("+") + "+";
  const formatRow = (row: string[]) =>
    "|" + row.map((cell, i) => ` ${(cell || "").padEnd(colWidths[i])} `).join("|") + "|";

  return [separator, formatRow(headers), separator, ...rows.map(formatRow), separator].join("\n");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(isoDate: string): string {
  if (!isoDate) return "never";
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

interface TestCaseIntersection {
  common: string[];
  onlyInBaseline: string[];
  onlyInCandidate: string[];
}

function computeTestCaseIntersection(baselineIds: string[], candidateIds: string[]): TestCaseIntersection {
  const baselineSet = new Set(baselineIds);
  const candidateSet = new Set(candidateIds);

  const common = baselineIds.filter((id) => candidateSet.has(id));
  const onlyInBaseline = baselineIds.filter((id) => !candidateSet.has(id));
  const onlyInCandidate = candidateIds.filter((id) => !baselineSet.has(id));

  return { common, onlyInBaseline, onlyInCandidate };
}

interface ABComparisonEntry {
  testCaseId: string;
  baselineScore: number;
  candidateScore: number;
  delta: number;
}

interface ABSummary {
  avgBaseline: number;
  avgCandidate: number;
  avgDelta: number;
  percentImprovement: number;
  baselineWins: number;
  candidateWins: number;
  ties: number;
  winner: "baseline" | "candidate" | "tie";
}

function computeABSummary(results: ABComparisonEntry[]): ABSummary {
  if (results.length === 0) {
    return {
      avgBaseline: 0,
      avgCandidate: 0,
      avgDelta: 0,
      percentImprovement: 0,
      baselineWins: 0,
      candidateWins: 0,
      ties: 0,
      winner: "tie",
    };
  }

  const avgBaseline = results.reduce((sum, r) => sum + r.baselineScore, 0) / results.length;
  const avgCandidate = results.reduce((sum, r) => sum + r.candidateScore, 0) / results.length;
  const avgDelta = avgCandidate - avgBaseline;
  const percentImprovement = avgBaseline > 0 ? ((avgCandidate - avgBaseline) / avgBaseline) * 100 : 0;

  let baselineWins = 0;
  let candidateWins = 0;
  let ties = 0;

  for (const r of results) {
    if (r.delta > 0.01) candidateWins++;
    else if (r.delta < -0.01) baselineWins++;
    else ties++;
  }

  let winner: "baseline" | "candidate" | "tie" = "tie";
  if (candidateWins > baselineWins) winner = "candidate";
  else if (baselineWins > candidateWins) winner = "baseline";

  return { avgBaseline, avgCandidate, avgDelta, percentImprovement, baselineWins, candidateWins, ties, winner };
}

function formatABComparisonTable(
  results: ABComparisonEntry[],
  summary: ABSummary,
  baselineLabel: string,
  candidateLabel: string,
): string {
  const headers = ["Test Case", "Baseline", "Candidate", "Delta", "Winner"];
  const rows: string[][] = results.map((r) => {
    const deltaStr = r.delta >= 0 ? `+${r.delta.toFixed(2)}` : r.delta.toFixed(2);
    let winner = "";
    if (r.delta > 0.01) winner = "★";
    else if (r.delta < -0.01) winner = "☆";
    else winner = "=";
    return [r.testCaseId, r.baselineScore.toFixed(2), r.candidateScore.toFixed(2), deltaStr, winner];
  });

  const summaryDeltaStr = summary.avgDelta >= 0 ? `+${summary.avgDelta.toFixed(2)}` : summary.avgDelta.toFixed(2);
  rows.push([
    "AVERAGE",
    summary.avgBaseline.toFixed(2),
    summary.avgCandidate.toFixed(2),
    summaryDeltaStr,
    summary.winner === "candidate" ? "★ WIN" : summary.winner === "baseline" ? "☆ WIN" : "TIE",
  ]);

  const table = formatTable(headers, rows);

  const winnerText =
    summary.winner === "candidate"
      ? `★ Candidate wins by ${summary.percentImprovement.toFixed(1)}%`
      : summary.winner === "baseline"
        ? `☆ Baseline wins by ${Math.abs(summary.percentImprovement).toFixed(1)}%`
        : `= Tie (no significant difference)`;

  const summaryLines = [
    "",
    `${color.dim(`Baseline:  ${baselineLabel}`)}`,
    `${color.dim(`Candidate: ${candidateLabel}`)}`,
    "",
    `${color.bold("Results:")} ${summary.candidateWins} candidate wins, ${summary.baselineWins} baseline wins, ${summary.ties} ties`,
    `${color.bold("Verdict:")} ${winnerText}`,
    "",
    `${color.dim("Legend: ★ = candidate better, ☆ = baseline better, = = tie")}`,
  ];

  return table + summaryLines.join("\n");
}

async function runValidate(args: TestBenchArgs): Promise<void> {
  if (!args.strategy) {
    console.error("Error: --strategy is required for validate command");
    process.exit(1);
  }

  console.log(`\n${color.cyan("Validating")} ${args.strategy}...\n`);

  const strategy = await loadStrategy(args.strategy);
  const testCases = filterTestCases(args.cases, args.mode, args.category);
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const prompt = generatePrompt(strategy, testCase);
      const hasStructure = validateStructureLocally(prompt);

      if (hasStructure) {
        console.log(`  ${color.green("✓")} ${testCase.id}`);
        passed++;
      } else {
        console.log(`  ${color.red("✗")} ${testCase.id} - Missing required tags (<role>, <objective>, <instructions>)`);
        failed++;
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ${color.red("✗")} ${testCase.id} - ${msg}`);
      failed++;
    }
  }

  console.log(`\n${color.bold("Summary:")} ${passed}/${passed + failed} passed\n`);
}

interface OptimizeResult {
  testCaseId: string;
  status: "cached" | "optimized" | "error";
  durationMs?: number;
  error?: string;
}

async function runOptimize(args: TestBenchArgs): Promise<void> {
  if (!args.strategy) {
    console.error("Error: --strategy is required for optimize command");
    process.exit(1);
  }

  const strategy = await loadStrategy(args.strategy);
  const testCases = filterTestCases(args.cases, args.mode, args.category);
  const engine = args.engine || DEFAULT_ENGINE;
  const model = args.model || (engine === "gemini" ? DEFAULT_MODEL_GEMINI : DEFAULT_MODEL_CODEX);
  const reasoning = args.reasoning || "high";
  const cache = new CacheManager();
  const concurrency = args.concurrency ?? 3;
  const limit = pLimit(concurrency);

  const reasoningInfo = engine === "codex" ? ` (reasoning: ${reasoning})` : "";
  console.log(
    `\n${color.cyan("Optimizing")} with ${strategy.id} (${engine}/${model}${reasoningInfo}) [concurrency: ${concurrency}]...\n`,
  );

  const startTime = Date.now();

  const optimizeOne = async (testCase: TestCase): Promise<OptimizeResult> => {
    const prompt = generatePrompt(strategy, testCase);
    const promptHash = cache.computePromptHash(prompt);

    const existing = cache.get(strategy.id, engine, model, testCase.id, promptHash);

    if (existing && !args.force) {
      return { testCaseId: testCase.id, status: "cached" };
    }

    const optStart = Date.now();

    try {
      let optimizedOutput: string;
      let metadata: OptimizationMetadata;

      if (engine === "gemini") {
        const result: GeminiRunResult = await runGeminiWithMetadata(prompt, { model });
        optimizedOutput = result.response;
        metadata = {
          timing: result.timing,
          retry: {
            attempts: result.retry.attempts,
            totalRetryDelayMs: result.retry.totalRetryDelayMs,
            failedAttempts: result.retry.failedAttempts,
          },
          tokens: result.tokens,
          promptCharCount: prompt.length,
          outputCharCount: result.response.length,
        };
      } else {
        const runStart = Date.now();
        optimizedOutput = await withRetry(() => runWithEngine(engine, prompt, { model, reasoningEffort: reasoning }));
        const runEnd = Date.now();
        const timing: TimingData = { startMs: runStart, endMs: runEnd, durationMs: runEnd - runStart };
        metadata = {
          timing,
          retry: { attempts: 1, totalRetryDelayMs: 0, failedAttempts: [] },
          tokens: null,
          promptCharCount: prompt.length,
          outputCharCount: optimizedOutput.length,
        };
      }

      const entry: CachedOptimizationEntry = {
        schemaVersion: "1.0",
        testCaseId: testCase.id,
        strategyId: strategy.id,
        engine,
        model,
        promptHash,
        optimizedOutput,
        metadata,
        cachedAt: new Date().toISOString(),
      };

      cache.set(entry);
      return { testCaseId: testCase.id, status: "optimized", durationMs: Date.now() - optStart };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return { testCaseId: testCase.id, status: "error", error: msg.slice(0, 60) };
    }
  };

  const results = await Promise.all(testCases.map((tc) => limit(() => optimizeOne(tc))));

  for (const result of results) {
    if (result.status === "cached") {
      console.log(`  ${color.green("✓")} ${result.testCaseId} ${color.dim("(cached)")}`);
    } else if (result.status === "optimized") {
      const duration = ((result.durationMs ?? 0) / 1000).toFixed(1);
      console.log(`  ${color.green("→")} ${result.testCaseId} optimized in ${duration}s`);
    } else {
      console.log(`  ${color.red("✗")} ${result.testCaseId} - ${result.error}`);
    }
  }

  const cacheHits = results.filter((r) => r.status === "cached").length;
  const apiCalls = results.filter((r) => r.status === "optimized").length;
  const errors = results.filter((r) => r.status === "error").length;
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(
    `\n${color.bold("Summary:")} ${testCases.length} test cases, ${cacheHits} cache hits, ${apiCalls} API calls${errors > 0 ? `, ${errors} errors` : ""}`,
  );
  console.log(`${color.bold("Duration:")} ${totalDuration}s\n`);
}

interface JudgeResultEntry {
  testCaseId: string;
  status: "success" | "no_cache" | "error";
  evaluation?: EvaluationResultV3;
  hasContext?: boolean;
  error?: string;
}

async function runJudge(args: TestBenchArgs): Promise<void> {
  if (!args.strategy) {
    console.error("Error: --strategy is required for judge command");
    process.exit(1);
  }
  if (!args.judge) {
    console.error("Error: --judge is required for judge command");
    process.exit(1);
  }

  const strategy = await loadStrategy(args.strategy);
  const testCases = filterTestCases(args.cases, args.mode, args.category);
  const engine = args.engine || DEFAULT_ENGINE;
  const model = args.model || (engine === "gemini" ? DEFAULT_MODEL_GEMINI : DEFAULT_MODEL_CODEX);
  const judgeConfig: JudgeConfig = JUDGES[args.judge];
  const cache = new CacheManager();
  const concurrency = args.concurrency ?? 3;
  const limit = pLimit(concurrency);

  console.log(`\n${color.cyan("Judging")} ${strategy.id} with ${args.judge} [concurrency: ${concurrency}]...\n`);

  const startTime = Date.now();

  const judgeOne = async (testCase: TestCase): Promise<JudgeResultEntry> => {
    const prompt = generatePrompt(strategy, testCase);
    const promptHash = cache.computePromptHash(prompt);

    const cached = cache.get(strategy.id, engine, model, testCase.id, promptHash);

    if (!cached) {
      return { testCaseId: testCase.id, status: "no_cache" };
    }

    try {
      const evalResult = await evaluateWithMetadata(
        testCase.id,
        strategy.id,
        testCase.userRequest,
        testCase.additionalContext,
        cached.optimizedOutput,
        cached.metadata,
        judgeConfig,
      );

      return {
        testCaseId: testCase.id,
        status: "success",
        evaluation: evalResult,
        hasContext: !!testCase.additionalContext,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return { testCaseId: testCase.id, status: "error", error: msg.slice(0, 60) };
    }
  };

  const judgeResults = await Promise.all(testCases.map((tc) => limit(() => judgeOne(tc))));

  for (const result of judgeResults) {
    if (result.status === "no_cache") {
      console.log(`  ${color.red("✗")} ${result.testCaseId} - No cached optimization (run optimize first)`);
    } else if (result.status === "error") {
      console.log(`  ${color.red("✗")} ${result.testCaseId} - ${result.error}`);
    } else if (result.evaluation) {
      const score = result.evaluation.totalScore.toFixed(2);
      const structure = result.evaluation.structurePass ? "pass" : "fail";
      const context = result.hasContext ? (result.evaluation.contextPass ? "pass" : "fail") : "N/A";
      console.log(
        `  ${color.green("✓")} ${result.testCaseId}: score=${score} (structure: ${structure}, context: ${context})`,
      );
    }
  }

  const successResults = judgeResults.filter(
    (r): r is JudgeResultEntry & { evaluation: EvaluationResultV3 } => r.status === "success" && !!r.evaluation,
  );
  const passed = successResults.filter((r) => r.evaluation.structurePass && r.evaluation.contextPass).length;
  const avgScore =
    successResults.length > 0
      ? successResults.reduce((sum, r) => sum + r.evaluation.totalScore, 0) / successResults.length
      : 0;

  console.log(
    `\n${color.bold("Summary:")} ${passed}/${successResults.length} passed, avg score: ${avgScore.toFixed(2)}`,
  );

  const reportDir = path.join(process.cwd(), "ab_results");
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(reportDir, `test_bench_${strategy.id}_${args.judge}_${timestamp}.json`);

  const report = {
    schemaVersion: "1.0",
    timestamp: new Date().toISOString(),
    strategy: strategy.id,
    engine,
    model,
    judge: args.judge,
    testCaseCount: testCases.length,
    durationSeconds: (Date.now() - startTime) / 1000,
    results: successResults.map((r) => ({ testCaseId: r.testCaseId, evaluation: r.evaluation })),
    summary: { passed, total: successResults.length, avgScore },
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`${color.bold("Results saved to:")} ${reportPath}\n`);
}

function runCacheStatus(): void {
  const cache = new CacheManager();
  const manifest = cache.getStatus();

  console.log(`\n${color.cyan("Cache Status")} (.prompt-cache/)\n`);
  console.log(`Total entries: ${manifest.totalEntries}`);
  console.log(`Disk usage: ${formatBytes(manifest.diskUsageBytes)}\n`);

  if (Object.keys(manifest.byStrategy).length > 0) {
    console.log("By Strategy:");
    const rows = Object.entries(manifest.byStrategy).map(([strategy, data]) => [
      strategy,
      String(data.count),
      data.engines.join(", "),
      formatRelativeTime(data.lastUpdated),
    ]);
    console.log(formatTable(["Strategy", "Count", "Engines", "Last Updated"], rows));
  }

  if (manifest.staleEntries.length > 0) {
    console.log(`\n${color.yellow("Stale entries:")} ${manifest.staleEntries.length}`);
    for (const entry of manifest.staleEntries.slice(0, 5)) {
      console.log(`  - ${entry}`);
    }
    if (manifest.staleEntries.length > 5) {
      console.log(`  ... and ${manifest.staleEntries.length - 5} more`);
    }
  }

  console.log("");
}

function runCacheClear(args: TestBenchArgs): void {
  const cache = new CacheManager();
  const filterDesc = args.strategy ? `strategy=${args.strategy}` : args.all ? "all" : "all";

  console.log(`\n${color.cyan("Clearing cache")}... (filter: ${filterDesc})\n`);

  const result = cache.clear(args.strategy ? { strategy: args.strategy } : undefined);

  console.log(`Cleared: ${result.cleared} entries (${formatBytes(result.bytesFreed)} freed)`);
  console.log(`Remaining: ${result.total - result.cleared} entries\n`);
}

function runCompare(args: TestBenchArgs): void {
  if (!args.runs || args.runs.length !== 2) {
    console.error("Error: --runs requires exactly two file paths");
    process.exit(1);
  }

  const [file1, file2] = args.runs;

  if (!fs.existsSync(file1)) {
    console.error(`File not found: ${file1}`);
    process.exit(1);
  }
  if (!fs.existsSync(file2)) {
    console.error(`File not found: ${file2}`);
    process.exit(1);
  }

  interface ResultFile {
    strategy?: string;
    judge?: string;
    results: Array<{ testCaseId: string; evaluation?: { totalScore: number }; totalScore?: number }>;
  }

  const data1: ResultFile = JSON.parse(fs.readFileSync(file1, "utf-8"));
  const data2: ResultFile = JSON.parse(fs.readFileSync(file2, "utf-8"));

  console.log(`\n${color.cyan("Comparing Results")}\n`);
  console.log(`File A: ${path.basename(file1)}`);
  console.log(`File B: ${path.basename(file2)}\n`);

  const scores1 = new Map<string, number>();
  const scores2 = new Map<string, number>();

  for (const r of data1.results) {
    const score = r.evaluation?.totalScore ?? r.totalScore ?? 0;
    scores1.set(r.testCaseId, score);
  }
  for (const r of data2.results) {
    const score = r.evaluation?.totalScore ?? r.totalScore ?? 0;
    scores2.set(r.testCaseId, score);
  }

  const allIds = new Set([...scores1.keys(), ...scores2.keys()]);
  const rows: string[][] = [];
  let totalA = 0;
  let totalB = 0;
  let count = 0;
  let agree = 0;

  for (const id of allIds) {
    const a = scores1.get(id) ?? 0;
    const b = scores2.get(id) ?? 0;
    const delta = b - a;
    const deltaStr = delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2);
    rows.push([id, a.toFixed(2), b.toFixed(2), deltaStr]);
    totalA += a;
    totalB += b;
    count++;
    if ((a > 0 && b > 0) || (a === 0 && b === 0)) agree++;
  }

  const avgA = count > 0 ? totalA / count : 0;
  const avgB = count > 0 ? totalB / count : 0;
  const avgDelta = avgB - avgA;
  rows.push(["Average", avgA.toFixed(2), avgB.toFixed(2), (avgDelta >= 0 ? "+" : "") + avgDelta.toFixed(2)]);

  console.log("Score Comparison:");
  console.log(formatTable(["Test Case", "File A", "File B", "Delta"], rows));

  const agreementRate = count > 0 ? (agree / count) * 100 : 0;
  console.log(`\nAgreement: ${agreementRate.toFixed(1)}% (${agree}/${count} same pass/fail)\n`);
}

async function runAB(args: TestBenchArgs): Promise<void> {
  if (!args.baselineRun) {
    console.error("Error: --baseline is required for ab command");
    process.exit(1);
  }
  if (!args.candidateRun) {
    console.error("Error: --candidate is required for ab command");
    process.exit(1);
  }
  if (!args.judge) {
    console.error("Error: --judge is required for ab command");
    process.exit(1);
  }

  const cache = new CacheManager();
  const cachedRuns = cache.listCachedOptimizations();

  const baselineRun = cachedRuns.find((r) => r.dirName === args.baselineRun);
  const candidateRun = cachedRuns.find((r) => r.dirName === args.candidateRun);

  if (!baselineRun) {
    console.error(`Error: Baseline run not found: ${args.baselineRun}`);
    console.error(`Available runs: ${cachedRuns.map((r) => r.dirName).join(", ") || "(none)"}`);
    process.exit(1);
  }
  if (!candidateRun) {
    console.error(`Error: Candidate run not found: ${args.candidateRun}`);
    console.error(`Available runs: ${cachedRuns.map((r) => r.dirName).join(", ") || "(none)"}`);
    process.exit(1);
  }

  const intersection = computeTestCaseIntersection(baselineRun.testCaseIds, candidateRun.testCaseIds);

  if (intersection.common.length === 0) {
    console.error("Error: No common test cases between baseline and candidate.");
    console.error(`Baseline has: ${baselineRun.testCaseIds.join(", ")}`);
    console.error(`Candidate has: ${candidateRun.testCaseIds.join(", ")}`);
    process.exit(1);
  }

  const testCaseIds =
    args.cases && args.cases.length > 0
      ? args.cases.filter((id) => intersection.common.includes(id))
      : intersection.common;

  if (testCaseIds.length === 0) {
    console.error("Error: None of the specified test cases are in both baseline and candidate.");
    process.exit(1);
  }

  const judgeConfig: JudgeConfig = JUDGES[args.judge];
  const concurrency = args.concurrency ?? 3;
  const limit = pLimit(concurrency);

  console.log(`\n${color.bgCyan(color.black(" A/B Comparison "))}\n`);
  console.log(`${color.bold("Baseline:")}  ${baselineRun.strategyId} (${baselineRun.engine}/${baselineRun.model})`);
  console.log(`${color.bold("Candidate:")} ${candidateRun.strategyId} (${candidateRun.engine}/${candidateRun.model})`);
  console.log(`${color.bold("Judge:")}     ${args.judge}`);
  console.log(`${color.bold("Cases:")}     ${testCaseIds.length}`);

  if (intersection.onlyInBaseline.length > 0 || intersection.onlyInCandidate.length > 0) {
    console.log("");
    if (intersection.onlyInBaseline.length > 0) {
      console.log(`${color.dim(`Skipped (baseline only): ${intersection.onlyInBaseline.join(", ")}`)}`);
    }
    if (intersection.onlyInCandidate.length > 0) {
      console.log(`${color.dim(`Skipped (candidate only): ${intersection.onlyInCandidate.join(", ")}`)}`);
    }
  }
  console.log("");

  const startTime = Date.now();

  const baselineStrategy = await loadStrategy(`src/prompts/${baselineRun.strategyId}.ts`);
  const candidateStrategy = await loadStrategy(`src/prompts/${candidateRun.strategyId}.ts`);

  const judgeForRun = async (
    run: CachedOptimizationRun,
    strategy: PromptStrategy,
    testCaseId: string,
  ): Promise<{ testCaseId: string; score: number; error?: string }> => {
    const testCase = TEST_CASES.find((tc) => tc.id === testCaseId);
    if (!testCase) {
      return { testCaseId, score: 0, error: "Test case not found" };
    }

    const prompt = generatePrompt(strategy, testCase);
    const promptHash = cache.computePromptHash(prompt);
    const cached = cache.get(run.strategyId, run.engine, run.model, testCaseId, promptHash);

    if (!cached) {
      return { testCaseId, score: 0, error: "No cache" };
    }

    try {
      const evalResult = await evaluateWithMetadata(
        testCaseId,
        strategy.id,
        testCase.userRequest,
        testCase.additionalContext,
        cached.optimizedOutput,
        cached.metadata,
        judgeConfig,
      );
      return { testCaseId, score: evalResult.totalScore };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return { testCaseId, score: 0, error: msg.slice(0, 40) };
    }
  };

  console.log(`${color.cyan("→")} Judging baseline (${baselineRun.strategyId})...`);
  const baselineResults = await Promise.all(
    testCaseIds.map((id) => limit(() => judgeForRun(baselineRun, baselineStrategy, id))),
  );
  console.log(`${color.green("✓")} Baseline complete`);

  console.log(`${color.cyan("→")} Judging candidate (${candidateRun.strategyId})...`);
  const candidateResults = await Promise.all(
    testCaseIds.map((id) => limit(() => judgeForRun(candidateRun, candidateStrategy, id))),
  );
  console.log(`${color.green("✓")} Candidate complete\n`);

  const baselineScores = new Map(baselineResults.map((r) => [r.testCaseId, r.score]));
  const candidateScores = new Map(candidateResults.map((r) => [r.testCaseId, r.score]));

  const comparisonResults: ABComparisonEntry[] = testCaseIds.map((id) => ({
    testCaseId: id,
    baselineScore: baselineScores.get(id) ?? 0,
    candidateScore: candidateScores.get(id) ?? 0,
    delta: (candidateScores.get(id) ?? 0) - (baselineScores.get(id) ?? 0),
  }));

  const summary = computeABSummary(comparisonResults);
  const baselineLabel = `${baselineRun.strategyId} (${baselineRun.engine}/${baselineRun.model})`;
  const candidateLabel = `${candidateRun.strategyId} (${candidateRun.engine}/${candidateRun.model})`;

  console.log(color.bold("Score Comparison:"));
  console.log(formatABComparisonTable(comparisonResults, summary, baselineLabel, candidateLabel));

  const reportDir = path.join(process.cwd(), "ab_results");
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(
    reportDir,
    `ab_compare_${baselineRun.strategyId}_vs_${candidateRun.strategyId}_${timestamp}.json`,
  );

  const report = {
    schemaVersion: "1.0",
    timestamp: new Date().toISOString(),
    baseline: {
      strategyId: baselineRun.strategyId,
      engine: baselineRun.engine,
      model: baselineRun.model,
      dirName: baselineRun.dirName,
    },
    candidate: {
      strategyId: candidateRun.strategyId,
      engine: candidateRun.engine,
      model: candidateRun.model,
      dirName: candidateRun.dirName,
    },
    judge: args.judge,
    testCaseCount: testCaseIds.length,
    durationSeconds: (Date.now() - startTime) / 1000,
    results: comparisonResults.map((r) => ({
      testCaseId: r.testCaseId,
      baseline: { score: r.baselineScore },
      candidate: { score: r.candidateScore },
      delta: r.delta,
    })),
    summary,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n${color.bold("Results saved to:")} ${reportPath}\n`);
}

async function interactiveMode(): Promise<void> {
  console.clear();
  p.intro(color.bgCyan(color.black(" Test Bench ")));

  const action = await p.select({
    message: "What would you like to do?",
    options: [
      { value: "validate", label: "Validate - Syntax check strategy code (FREE, no LLM)" },
      { value: "optimize", label: "Optimize - Run LLM and cache results (costs $)" },
      { value: "judge", label: "Judge - Score cached outputs with LLM (costs $)" },
      { value: "cache", label: "Cache - View status or clear" },
      { value: "compare", label: "Compare - Diff two result files" },
      { value: "ab", label: "A/B Test - Compare two cached strategies head-to-head (costs $)" },
    ],
  });

  if (p.isCancel(action)) {
    p.cancel("Cancelled");
    process.exit(0);
  }

  if (action === "cache") {
    const cacheAction = await p.select({
      message: "Cache operation:",
      options: [
        { value: "status", label: "Status - View cache summary" },
        { value: "clear", label: "Clear - Remove cached entries" },
      ],
    });

    if (p.isCancel(cacheAction)) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    if (cacheAction === "status") {
      runCacheStatus();
    } else {
      const confirmClear = await p.confirm({
        message: "Clear all cache entries?",
        initialValue: false,
      });
      if (p.isCancel(confirmClear) || !confirmClear) {
        p.cancel("Cancelled");
        process.exit(0);
      }
      runCacheClear({ command: "cache", all: true });
    }
    p.outro("Done!");
    return;
  }

  if (action === "judge") {
    const cache = new CacheManager();
    const cachedRuns = cache.listCachedOptimizations();
    const hasCachedRuns = cachedRuns.length > 0;

    const judgeMode = await p.select({
      message: "Judge mode:",
      options: [
        ...(hasCachedRuns
          ? [{ value: "cached", label: `Judge existing cached optimizations (${cachedRuns.length} available)` }]
          : []),
        { value: "regenerate", label: "Regenerate optimizations then judge" },
      ],
    });

    if (p.isCancel(judgeMode)) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    if (judgeMode === "cached") {
      const cachedRunSelection = await p.select({
        message: "Select cached optimization to judge:",
        options: cachedRuns.map((run) => ({
          value: run.dirName,
          label: `${run.strategyId} / ${run.engine} / ${run.model} (${run.testCaseCount} cases, ${formatRelativeTime(run.lastUpdated)})`,
        })),
      });

      if (p.isCancel(cachedRunSelection)) {
        p.cancel("Cancelled");
        process.exit(0);
      }

      const selectedRun = cachedRuns.find((r) => r.dirName === cachedRunSelection) as CachedOptimizationRun;

      const judge = await p.select({
        message: "Select judge:",
        options: Object.keys(JUDGES).map((j) => ({ value: j, label: j })),
      });

      if (p.isCancel(judge)) {
        p.cancel("Cancelled");
        process.exit(0);
      }

      const testCaseSelection = await p.select({
        message: `Test cases to judge (${selectedRun.testCaseCount} cached):`,
        options: [
          { value: "all", label: `All cached (${selectedRun.testCaseCount})` },
          { value: "custom", label: "Select specific cases" },
        ],
      });

      if (p.isCancel(testCaseSelection)) {
        p.cancel("Cancelled");
        process.exit(0);
      }

      let cases: string[];
      if (testCaseSelection === "custom") {
        const selected = await p.multiselect({
          message: "Select test cases:",
          options: selectedRun.testCaseIds.map((id) => ({ value: id, label: id })),
          required: true,
        });
        if (p.isCancel(selected)) {
          p.cancel("Cancelled");
          process.exit(0);
        }
        cases = selected as string[];
      } else {
        cases = selectedRun.testCaseIds;
      }

      const testCount = cases.length;
      const estimatedCost = ((testCount * 2000) / 1_000_000) * 0.075;

      p.note(
        `Test cases: ${testCount}\nEstimated API calls: ${testCount}\nEstimated cost: ~$${estimatedCost.toFixed(3)}`,
        "Cost Estimate",
      );

      const confirmed = await p.confirm({
        message: "Proceed?",
        initialValue: true,
      });

      if (p.isCancel(confirmed) || !confirmed) {
        p.cancel("Cancelled");
        process.exit(0);
      }

      const spinner = p.spinner();
      spinner.start("Running judge...");

      try {
        const strategyPath = `src/prompts/${selectedRun.strategyId}.ts`;
        await runJudge({
          command: "judge",
          strategy: strategyPath,
          cases,
          engine: selectedRun.engine,
          model: selectedRun.model,
          judge: judge as JudgeId,
        });
        spinner.stop("Evaluation complete");
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        spinner.stop(`Error: ${msg}`);
      }

      p.outro("Done!");
      return;
    }

    const strategies = await discoverStrategies();
    if (strategies.length === 0) {
      p.cancel("No strategies found in src/prompts/");
      process.exit(1);
    }

    const strategy = await p.select({
      message: "Select strategy:",
      options: strategies.map((s) => ({ value: s.path, label: `${s.id} - ${s.name}` })),
    });
    if (p.isCancel(strategy)) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    const modeFilter = await p.select({
      message: "Filter by mode:",
      options: [
        { value: "all", label: "All modes" },
        { value: "quick", label: "Quick only" },
        { value: "detailed", label: "Detailed only" },
      ],
    });
    if (p.isCancel(modeFilter)) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    const categoryFilter = await p.select({
      message: "Filter by category:",
      options: [{ value: "all", label: "All categories" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))],
    });
    if (p.isCancel(categoryFilter)) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    const mode = modeFilter === "all" ? undefined : (modeFilter as "quick" | "detailed");
    const category = categoryFilter === "all" ? undefined : (categoryFilter as string);
    const availableTestCases = filterTestCases(undefined, mode, category);

    const testCaseSelection = await p.select({
      message: `Test cases (${availableTestCases.length} available):`,
      options: [
        { value: "all", label: `All filtered (${availableTestCases.length})` },
        {
          value: "smoke",
          label: `Smoke tests (${SMOKE_TEST_CASES.filter((id) => availableTestCases.some((tc) => tc.id === id)).length} matching)`,
        },
        { value: "custom", label: "Select specific cases" },
      ],
    });
    if (p.isCancel(testCaseSelection)) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    let cases: string[] | undefined;
    if (testCaseSelection === "smoke") {
      cases = SMOKE_TEST_CASES.filter((id) => availableTestCases.some((tc) => tc.id === id));
    } else if (testCaseSelection === "custom") {
      const selected = await p.multiselect({
        message: "Select test cases:",
        options: availableTestCases.map((tc) => ({ value: tc.id, label: `${tc.id} - ${tc.description}` })),
        required: true,
      });
      if (p.isCancel(selected)) {
        p.cancel("Cancelled");
        process.exit(0);
      }
      cases = selected as string[];
    }

    const engine = await p.select({
      message: "Engine:",
      options: [
        { value: "gemini", label: "Gemini (gemini-3-flash-preview)" },
        { value: "codex", label: "Codex (gpt-5.2-codex)" },
      ],
    });
    if (p.isCancel(engine)) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    let reasoning: "high" | "medium" | "low" | undefined;
    if (engine === "codex") {
      const reasoningChoice = await p.select({
        message: "Codex reasoning effort:",
        options: [
          { value: "high", label: "High (best quality, slower)" },
          { value: "medium", label: "Medium (balanced)" },
          { value: "low", label: "Low (faster, cheaper)" },
        ],
      });
      if (p.isCancel(reasoningChoice)) {
        p.cancel("Cancelled");
        process.exit(0);
      }
      reasoning = reasoningChoice as "high" | "medium" | "low";
    }

    const judge = await p.select({
      message: "Select judge:",
      options: Object.keys(JUDGES).map((j) => ({ value: j, label: j })),
    });
    if (p.isCancel(judge)) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    const testCount = cases?.length || availableTestCases.length;
    const optimizeCalls = testCount;
    const judgeCalls = testCount;
    const estimatedCost = (((optimizeCalls + judgeCalls) * 2000) / 1_000_000) * 0.075;

    p.note(
      `Test cases: ${testCount}\nOptimize calls: ${optimizeCalls}\nJudge calls: ${judgeCalls}\nEstimated cost: ~$${estimatedCost.toFixed(3)}`,
      "Cost Estimate",
    );

    const confirmed = await p.confirm({
      message: "Proceed?",
      initialValue: true,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    const spinner = p.spinner();
    const model = engine === "gemini" ? DEFAULT_MODEL_GEMINI : DEFAULT_MODEL_CODEX;

    try {
      spinner.start("Optimizing...");
      await runOptimize({
        command: "optimize",
        strategy: strategy as string,
        cases,
        mode,
        category,
        engine: engine as EngineType,
        model,
        reasoning,
        force: true,
      });
      spinner.stop("Optimization complete");

      spinner.start("Judging...");
      await runJudge({
        command: "judge",
        strategy: strategy as string,
        cases,
        engine: engine as EngineType,
        model,
        judge: judge as JudgeId,
      });
      spinner.stop("Evaluation complete");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      spinner.stop(`Error: ${msg}`);
    }

    p.outro("Done!");
    return;
  }

  if (action === "compare") {
    const file1 = await p.text({
      message: "Path to first result file:",
      placeholder: "ab_results/file1.json",
    });
    if (p.isCancel(file1)) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    const file2 = await p.text({
      message: "Path to second result file:",
      placeholder: "ab_results/file2.json",
    });
    if (p.isCancel(file2)) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    runCompare({ command: "compare", runs: [file1 as string, file2 as string] });
    p.outro("Done!");
    return;
  }

  if (action === "ab") {
    const cache = new CacheManager();
    const cachedRuns = cache.listCachedOptimizations();

    if (cachedRuns.length < 2) {
      p.cancel(`Need at least 2 cached runs for A/B comparison. Found: ${cachedRuns.length}. Run 'optimize' first.`);
      process.exit(1);
    }

    p.note(
      `Available cached runs: ${cachedRuns.length}\n` +
        `Select a BASELINE (control) and CANDIDATE (experiment) to compare.`,
      "A/B Comparison Setup",
    );

    const baselineSelection = await p.select({
      message: "Baseline (control):",
      options: cachedRuns.map((run) => ({
        value: run.dirName,
        label: `${run.strategyId} / ${run.engine} / ${run.model} (${run.testCaseCount} cases, ${formatRelativeTime(run.lastUpdated)})`,
      })),
    });
    if (p.isCancel(baselineSelection)) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    const baselineRun = cachedRuns.find((r) => r.dirName === baselineSelection) as CachedOptimizationRun;
    const candidateOptions = cachedRuns.filter((r) => r.dirName !== baselineSelection);

    if (candidateOptions.length === 0) {
      p.cancel("No other cached runs available for comparison.");
      process.exit(1);
    }

    const candidateSelection = await p.select({
      message: "Candidate (experiment):",
      options: candidateOptions.map((run) => ({
        value: run.dirName,
        label: `${run.strategyId} / ${run.engine} / ${run.model} (${run.testCaseCount} cases, ${formatRelativeTime(run.lastUpdated)})`,
      })),
    });
    if (p.isCancel(candidateSelection)) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    const candidateRun = cachedRuns.find((r) => r.dirName === candidateSelection) as CachedOptimizationRun;
    const intersection = computeTestCaseIntersection(baselineRun.testCaseIds, candidateRun.testCaseIds);

    if (intersection.common.length === 0) {
      p.cancel(
        `No common test cases between baseline and candidate.\n` +
          `Baseline has: ${baselineRun.testCaseIds.join(", ")}\n` +
          `Candidate has: ${candidateRun.testCaseIds.join(", ")}`,
      );
      process.exit(1);
    }

    const intersectionNote =
      `Common: ${intersection.common.length} test cases` +
      (intersection.onlyInBaseline.length > 0 ? `\nOnly in baseline: ${intersection.onlyInBaseline.join(", ")}` : "") +
      (intersection.onlyInCandidate.length > 0
        ? `\nOnly in candidate: ${intersection.onlyInCandidate.join(", ")}`
        : "");
    p.note(intersectionNote, "Test Case Intersection");

    const testCaseSelection = await p.select({
      message: `Test cases to compare:`,
      options: [
        { value: "all", label: `All common (${intersection.common.length})` },
        { value: "custom", label: "Select specific cases" },
      ],
    });
    if (p.isCancel(testCaseSelection)) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    let testCaseIds: string[];
    if (testCaseSelection === "custom") {
      const selected = await p.multiselect({
        message: "Select test cases:",
        options: intersection.common.map((id) => ({ value: id, label: id })),
        required: true,
      });
      if (p.isCancel(selected)) {
        p.cancel("Cancelled");
        process.exit(0);
      }
      testCaseIds = selected as string[];
    } else {
      testCaseIds = intersection.common;
    }

    const judge = await p.select({
      message: "Select judge:",
      options: Object.keys(JUDGES).map((j) => ({ value: j, label: j })),
    });
    if (p.isCancel(judge)) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    const testCount = testCaseIds.length;
    const judgeCalls = testCount * 2;
    const estimatedCost = ((judgeCalls * 2000) / 1_000_000) * 0.075;

    p.note(
      `Test cases: ${testCount}\n` +
        `Judge calls: ${judgeCalls} (${testCount} baseline + ${testCount} candidate)\n` +
        `Estimated cost: ~$${estimatedCost.toFixed(3)}`,
      "Cost Estimate",
    );

    const confirmed = await p.confirm({
      message: "Proceed?",
      initialValue: true,
    });
    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    try {
      await runAB({
        command: "ab",
        baselineRun: baselineRun.dirName,
        candidateRun: candidateRun.dirName,
        judge: judge as JudgeId,
        cases: testCaseIds,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`${color.red("Error:")} ${msg}`);
    }

    p.outro("Done!");
    return;
  }

  const strategies = await discoverStrategies();
  if (strategies.length === 0) {
    p.cancel("No strategies found in src/prompts/");
    process.exit(1);
  }

  const strategy = await p.select({
    message: "Select strategy:",
    options: strategies.map((s) => ({ value: s.path, label: `${s.id} - ${s.name}` })),
  });
  if (p.isCancel(strategy)) {
    p.cancel("Cancelled");
    process.exit(0);
  }

  const modeFilter = await p.select({
    message: "Filter by mode:",
    options: [
      { value: "all", label: "All modes" },
      { value: "quick", label: "Quick only" },
      { value: "detailed", label: "Detailed only" },
    ],
  });
  if (p.isCancel(modeFilter)) {
    p.cancel("Cancelled");
    process.exit(0);
  }

  const categoryFilter = await p.select({
    message: "Filter by category:",
    options: [{ value: "all", label: "All categories" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))],
  });
  if (p.isCancel(categoryFilter)) {
    p.cancel("Cancelled");
    process.exit(0);
  }

  const mode = modeFilter === "all" ? undefined : (modeFilter as "quick" | "detailed");
  const category = categoryFilter === "all" ? undefined : (categoryFilter as string);
  const availableTestCases = filterTestCases(undefined, mode, category);

  const testCaseSelection = await p.select({
    message: `Test cases to run (${availableTestCases.length} available):`,
    options: [
      { value: "all", label: `All filtered (${availableTestCases.length})` },
      {
        value: "smoke",
        label: `Smoke tests (${SMOKE_TEST_CASES.filter((id) => availableTestCases.some((tc) => tc.id === id)).length} matching)`,
      },
      { value: "custom", label: "Select specific cases" },
    ],
  });
  if (p.isCancel(testCaseSelection)) {
    p.cancel("Cancelled");
    process.exit(0);
  }

  let cases: string[] | undefined;
  if (testCaseSelection === "smoke") {
    cases = SMOKE_TEST_CASES.filter((id) => availableTestCases.some((tc) => tc.id === id));
  } else if (testCaseSelection === "custom") {
    const selected = await p.multiselect({
      message: "Select test cases:",
      options: availableTestCases.map((tc) => ({ value: tc.id, label: `${tc.id} - ${tc.description}` })),
      required: true,
    });
    if (p.isCancel(selected)) {
      p.cancel("Cancelled");
      process.exit(0);
    }
    cases = selected as string[];
  }

  const args: TestBenchArgs = {
    command: action as Command,
    strategy: strategy as string,
    cases,
    mode,
    category,
  };

  if (action === "optimize") {
    const engine = await p.select({
      message: "Engine:",
      options: [
        { value: "gemini", label: "Gemini (gemini-3-flash-preview)" },
        { value: "codex", label: "Codex (gpt-5.2-codex)" },
      ],
    });
    if (p.isCancel(engine)) {
      p.cancel("Cancelled");
      process.exit(0);
    }
    args.engine = engine as EngineType;

    if (engine === "codex") {
      const reasoning = await p.select({
        message: "Codex reasoning effort:",
        options: [
          { value: "high", label: "High (best quality, slower)" },
          { value: "medium", label: "Medium (balanced)" },
          { value: "low", label: "Low (faster, cheaper)" },
        ],
      });
      if (p.isCancel(reasoning)) {
        p.cancel("Cancelled");
        process.exit(0);
      }
      args.reasoning = reasoning as "high" | "medium" | "low";
    }
  }

  if (action === "optimize") {
    const force = await p.confirm({
      message: "Force regeneration (bypass cache)?",
      initialValue: false,
    });
    if (p.isCancel(force)) {
      p.cancel("Cancelled");
      process.exit(0);
    }
    args.force = force;
  }

  const testCount = cases?.length || availableTestCases.length;
  const estimatedCalls = action === "optimize" ? testCount : 0;
  const estimatedCost = ((estimatedCalls * 2000) / 1_000_000) * 0.075;

  if (estimatedCalls > 0) {
    p.note(
      `Test cases: ${testCount}\nEstimated API calls: ${estimatedCalls}\nEstimated cost: ~$${estimatedCost.toFixed(3)}`,
      "Cost Estimate",
    );
  }

  const confirmed = await p.confirm({
    message: "Proceed?",
    initialValue: true,
  });
  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel("Cancelled");
    process.exit(0);
  }

  const spinner = p.spinner();
  spinner.start("Running...");

  try {
    if (action === "validate") {
      spinner.stop("Validation complete");
      await runValidate(args);
    } else if (action === "optimize") {
      spinner.stop("Optimization complete");
      await runOptimize(args);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    spinner.stop(`Error: ${msg}`);
  }

  p.outro("Done!");
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (!args) {
    await interactiveMode();
    return;
  }

  switch (args.command) {
    case "validate":
      await runValidate(args);
      break;
    case "optimize":
      await runOptimize(args);
      break;
    case "judge":
      await runJudge(args);
      break;
    case "cache":
      if (args.cacheSubcommand === "clear") {
        runCacheClear(args);
      } else {
        runCacheStatus();
      }
      break;
    case "compare":
      runCompare(args);
      break;
    case "ab":
      await runAB(args);
      break;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
