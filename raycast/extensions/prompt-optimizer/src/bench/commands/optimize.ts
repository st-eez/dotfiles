import pLimit from "p-limit";
import { TestCase } from "../../test-data/test-cases";
import { CacheManager, CachedOptimizationEntry } from "../../utils/cache";
import { runGeminiWithMetadata, runWithEngine, withRetry, GeminiRunResult } from "../../test/lib/test-utils";
import { OptimizationMetadata, TimingData } from "../../utils/types";
import { log, c, symbols, subheader, keyValue } from "../../utils/cli-output";
import { startProgress, incrementProgress, finishProgress } from "../../utils/cli-progress";
import { wasCancelled, setPartialResults, onCancel, printCancellationSummary } from "../../utils/cli-cancel";
import {
  TestBenchArgs,
  OptimizeResult,
  DEFAULT_ENGINE,
  DEFAULT_MODEL_GEMINI,
  DEFAULT_MODEL_CODEX,
  loadStrategy,
  filterTestCases,
  generatePrompt,
} from "../types";

export async function runOptimize(args: TestBenchArgs): Promise<void> {
  if (!args.strategy) {
    log.error("--strategy is required for optimize command");
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
  subheader(`Optimizing with ${strategy.id} (${engine}/${model}${reasoningInfo})`);
  keyValue("Concurrency", concurrency);

  const startTime = Date.now();
  const results: OptimizeResult[] = [];

  onCancel(() => {
    finishProgress();
    printCancellationSummary();
  });

  startProgress(testCases.length, "Optimizing", { showCacheStats: true });

  const optimizeOne = async (testCase: TestCase): Promise<OptimizeResult> => {
    if (wasCancelled()) {
      return { testCaseId: testCase.id, status: "error", error: "cancelled" };
    }

    const prompt = generatePrompt(strategy, testCase);
    const promptHash = cache.computePromptHash(prompt);

    const existing = cache.get(strategy.id, engine, model, testCase.id, promptHash);

    if (existing && !args.force) {
      incrementProgress({ cacheHit: true });
      return { testCaseId: testCase.id, status: "cached" };
    }

    const optStart = Date.now();

    try {
      if (wasCancelled()) {
        return { testCaseId: testCase.id, status: "error", error: "cancelled" };
      }

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
      incrementProgress({ cacheHit: false });
      return { testCaseId: testCase.id, status: "optimized", durationMs: Date.now() - optStart };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      incrementProgress({ error: true });
      return { testCaseId: testCase.id, status: "error", error: msg.slice(0, 60) };
    }
  };

  const processOne = async (testCase: TestCase): Promise<void> => {
    const result = await optimizeOne(testCase);
    results.push(result);
    setPartialResults({
      completed: results.length,
      total: testCases.length,
      startTime,
    });
  };

  await Promise.all(testCases.map((tc) => limit(() => processOne(tc))));

  finishProgress();

  for (const result of results) {
    if (result.status === "cached") {
      log.plain(`  ${symbols.ok} ${result.testCaseId} ${c.dim("(cached)")}`);
    } else if (result.status === "optimized") {
      const duration = ((result.durationMs ?? 0) / 1000).toFixed(1);
      log.plain(`  ${symbols.arrow} ${result.testCaseId} optimized in ${duration}s`);
    } else {
      log.plain(`  ${symbols.fail} ${result.testCaseId} - ${result.error}`);
    }
  }

  const cacheHits = results.filter((r) => r.status === "cached").length;
  const apiCalls = results.filter((r) => r.status === "optimized").length;
  const errors = results.filter((r) => r.status === "error").length;
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

  log.blank();
  log.plain(
    `${c.bold("Summary:")} ${testCases.length} test cases, ${cacheHits} cache hits, ${apiCalls} API calls${errors > 0 ? `, ${errors} errors` : ""}`,
  );
  log.plain(`${c.bold("Duration:")} ${totalDuration}s`);
  log.blank();
}
