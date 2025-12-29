import * as fs from "fs";
import * as path from "path";
import pLimit from "p-limit";
import { TestCase } from "../../test-data/test-cases";
import { CacheManager } from "../../utils/cache";
import { evaluateWithMetadata, JUDGES, JudgeConfig, EvaluationResultV3 } from "../../utils/evaluator";
import { log, c, symbols, subheader, keyValue } from "../../utils/cli-output";
import {
  TestBenchArgs,
  JudgeResultEntry,
  DEFAULT_ENGINE,
  DEFAULT_MODEL_GEMINI,
  DEFAULT_MODEL_CODEX,
  loadStrategy,
  filterTestCases,
  generatePrompt,
} from "../types";

export async function runJudge(args: TestBenchArgs): Promise<void> {
  if (!args.strategy) {
    log.error("--strategy is required for judge command");
    process.exit(1);
  }
  if (!args.judge) {
    log.error("--judge is required for judge command");
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

  subheader(`Judging ${strategy.id} with ${args.judge}`);
  keyValue("Concurrency", concurrency);

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
      log.plain(`  ${symbols.fail} ${result.testCaseId} - No cached optimization (run optimize first)`);
    } else if (result.status === "error") {
      log.plain(`  ${symbols.fail} ${result.testCaseId} - ${result.error}`);
    } else if (result.evaluation) {
      const score = result.evaluation.totalScore.toFixed(2);
      const structure = result.evaluation.structurePass ? "pass" : "fail";
      const context = result.hasContext ? (result.evaluation.contextPass ? "pass" : "fail") : "N/A";
      log.plain(`  ${symbols.ok} ${result.testCaseId}: score=${score} (structure: ${structure}, context: ${context})`);
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

  log.blank();
  log.plain(`${c.bold("Summary:")} ${passed}/${successResults.length} passed, avg score: ${avgScore.toFixed(2)}`);

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
  log.plain(`${c.bold("Results saved to:")} ${reportPath}`);
  log.blank();
}
