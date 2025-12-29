import * as fs from "fs";
import * as path from "path";
import color from "picocolors";
import pLimit from "p-limit";
import { TEST_CASES } from "../../test-data/test-cases";
import { CacheManager, CachedOptimizationRun } from "../../utils/cache";
import { evaluateWithMetadata, JUDGES, JudgeConfig } from "../../utils/evaluator";
import { PromptStrategy } from "../../prompts/types";
import {
  TestBenchArgs,
  ABComparisonEntry,
  computeTestCaseIntersection,
  computeABSummary,
  formatABComparisonTable,
  loadStrategy,
  generatePrompt,
} from "../types";

export async function runAB(args: TestBenchArgs): Promise<void> {
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
