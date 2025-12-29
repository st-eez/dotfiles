import * as fs from "fs";
import * as path from "path";
import pLimit from "p-limit";
import { TEST_CASES } from "../../test-data/test-cases";
import { CacheManager, CachedOptimizationRun } from "../../utils/cache";
import { evaluateWithMetadata, JUDGES, JudgeConfig } from "../../utils/evaluator";
import { PromptStrategy } from "../../prompts/types";
import { log, c, labeledHeader, keyValue } from "../../utils/cli-output";
import { printSimpleTable } from "../../utils/cli-table";
import { startProgress, incrementProgress, finishProgress, setProgressPhase } from "../../utils/cli-progress";
import { wasCancelled, setPartialResults, onCancel, printCancellationSummary } from "../../utils/cli-cancel";
import {
  TestBenchArgs,
  ABComparisonEntry,
  computeTestCaseIntersection,
  computeABSummary,
  loadStrategy,
  generatePrompt,
} from "../types";

export async function runAB(args: TestBenchArgs): Promise<void> {
  if (!args.baselineRun) {
    log.error("--baseline is required for ab command");
    process.exit(1);
  }
  if (!args.candidateRun) {
    log.error("--candidate is required for ab command");
    process.exit(1);
  }
  if (!args.judge) {
    log.error("--judge is required for ab command");
    process.exit(1);
  }

  const cache = new CacheManager();
  const cachedRuns = cache.listCachedOptimizations();

  const baselineRun = cachedRuns.find((r) => r.dirName === args.baselineRun);
  const candidateRun = cachedRuns.find((r) => r.dirName === args.candidateRun);

  if (!baselineRun) {
    log.error(`Baseline run not found: ${args.baselineRun}`);
    log.plain(`Available runs: ${cachedRuns.map((r) => r.dirName).join(", ") || "(none)"}`);
    process.exit(1);
  }
  if (!candidateRun) {
    log.error(`Candidate run not found: ${args.candidateRun}`);
    log.plain(`Available runs: ${cachedRuns.map((r) => r.dirName).join(", ") || "(none)"}`);
    process.exit(1);
  }

  const intersection = computeTestCaseIntersection(baselineRun.testCaseIds, candidateRun.testCaseIds);

  if (intersection.common.length === 0) {
    log.error("No common test cases between baseline and candidate.");
    log.plain(`Baseline has: ${baselineRun.testCaseIds.join(", ")}`);
    log.plain(`Candidate has: ${candidateRun.testCaseIds.join(", ")}`);
    process.exit(1);
  }

  const testCaseIds =
    args.cases && args.cases.length > 0
      ? args.cases.filter((id) => intersection.common.includes(id))
      : intersection.common;

  if (testCaseIds.length === 0) {
    log.error("None of the specified test cases are in both baseline and candidate.");
    process.exit(1);
  }

  const judgeConfig: JudgeConfig = JUDGES[args.judge];
  const concurrency = args.concurrency ?? 3;
  const limit = pLimit(concurrency);

  labeledHeader("A/B Comparison", "blue");
  keyValue("Baseline", `${baselineRun.strategyId} (${baselineRun.engine}/${baselineRun.model})`);
  keyValue("Candidate", `${candidateRun.strategyId} (${candidateRun.engine}/${candidateRun.model})`);
  keyValue("Judge", args.judge);
  keyValue("Cases", testCaseIds.length);

  if (intersection.onlyInBaseline.length > 0 || intersection.onlyInCandidate.length > 0) {
    log.blank();
    if (intersection.onlyInBaseline.length > 0) {
      log.plain(c.dim(`Skipped (baseline only): ${intersection.onlyInBaseline.join(", ")}`));
    }
    if (intersection.onlyInCandidate.length > 0) {
      log.plain(c.dim(`Skipped (candidate only): ${intersection.onlyInCandidate.join(", ")}`));
    }
  }
  log.blank();

  const startTime = Date.now();

  onCancel(() => {
    finishProgress();
    printCancellationSummary();
  });

  const baselineStrategy = await loadStrategy(`src/prompts/${baselineRun.strategyId}.ts`);
  const candidateStrategy = await loadStrategy(`src/prompts/${candidateRun.strategyId}.ts`);

  type JudgeResult = { testCaseId: string; score: number; error?: string };

  const judgeForRun = async (
    run: CachedOptimizationRun,
    strategy: PromptStrategy,
    testCaseId: string,
  ): Promise<JudgeResult> => {
    if (wasCancelled()) {
      return { testCaseId, score: 0, error: "cancelled" };
    }

    const testCase = TEST_CASES.find((tc) => tc.id === testCaseId);
    if (!testCase) {
      incrementProgress();
      return { testCaseId, score: 0, error: "Test case not found" };
    }

    const prompt = generatePrompt(strategy, testCase);
    const promptHash = cache.computePromptHash(prompt);
    const cached = cache.get(run.strategyId, run.engine, run.model, testCaseId, promptHash);

    if (!cached) {
      incrementProgress();
      return { testCaseId, score: 0, error: "No cache" };
    }

    try {
      if (wasCancelled()) {
        return { testCaseId, score: 0, error: "cancelled" };
      }

      const evalResult = await evaluateWithMetadata(
        testCaseId,
        strategy.id,
        testCase.userRequest,
        testCase.additionalContext,
        cached.optimizedOutput,
        cached.metadata,
        judgeConfig,
      );
      incrementProgress();
      return { testCaseId, score: evalResult.totalScore };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      incrementProgress({ error: true });
      return { testCaseId, score: 0, error: msg.slice(0, 40) };
    }
  };

  const totalWork = testCaseIds.length * 2;
  startProgress(totalWork, `Baseline (${baselineRun.strategyId})`);

  const baselineResults: JudgeResult[] = [];
  for (const id of testCaseIds) {
    if (wasCancelled()) break;
    const result = await limit(() => judgeForRun(baselineRun, baselineStrategy, id));
    baselineResults.push(result);
    setPartialResults({
      completed: baselineResults.length,
      total: totalWork,
      startTime,
    });
  }

  if (wasCancelled()) {
    finishProgress();
    return;
  }

  setProgressPhase(`Candidate (${candidateRun.strategyId})`);

  const candidateResults: JudgeResult[] = [];
  for (const id of testCaseIds) {
    if (wasCancelled()) break;
    const result = await limit(() => judgeForRun(candidateRun, candidateStrategy, id));
    candidateResults.push(result);
    setPartialResults({
      completed: baselineResults.length + candidateResults.length,
      total: totalWork,
      startTime,
    });
  }

  finishProgress();

  if (wasCancelled()) {
    return;
  }

  log.blank();

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

  log.plain(c.bold("Score Comparison:"));
  const tableRows: Array<Array<string | number>> = comparisonResults.map((r) => {
    const deltaStr = r.delta >= 0 ? `+${r.delta.toFixed(2)}` : r.delta.toFixed(2);
    let winner = "";
    if (r.delta > 0.01) winner = "★";
    else if (r.delta < -0.01) winner = "☆";
    else winner = "=";
    return [r.testCaseId, r.baselineScore.toFixed(2), r.candidateScore.toFixed(2), deltaStr, winner];
  });
  const summaryDeltaStr = summary.avgDelta >= 0 ? `+${summary.avgDelta.toFixed(2)}` : summary.avgDelta.toFixed(2);
  tableRows.push([
    c.bold("AVERAGE"),
    summary.avgBaseline.toFixed(2),
    summary.avgCandidate.toFixed(2),
    summaryDeltaStr,
    summary.winner === "candidate" ? "★ WIN" : summary.winner === "baseline" ? "☆ WIN" : "TIE",
  ]);
  printSimpleTable(["Test Case", "Baseline", "Candidate", "Delta", "Winner"], tableRows);

  log.blank();
  keyValue("Baseline", baselineLabel);
  keyValue("Candidate", candidateLabel);
  log.blank();
  const winnerText =
    summary.winner === "candidate"
      ? `★ Candidate wins by ${summary.percentImprovement.toFixed(1)}%`
      : summary.winner === "baseline"
        ? `☆ Baseline wins by ${Math.abs(summary.percentImprovement).toFixed(1)}%`
        : `= Tie (no significant difference)`;
  log.plain(
    `Results: ${summary.candidateWins} candidate wins, ${summary.baselineWins} baseline wins, ${summary.ties} ties`,
  );
  log.plain(`Verdict: ${winnerText}`);
  log.plain(c.dim(`Legend: ★ = candidate better, ☆ = baseline better, = = tie`));

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
  log.blank();
  log.plain(`${c.bold("Results saved to:")} ${reportPath}`);
  log.blank();
}
