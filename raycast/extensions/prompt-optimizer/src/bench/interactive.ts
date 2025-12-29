import * as p from "@clack/prompts";
import color from "picocolors";
import { CacheManager, CachedOptimizationRun } from "../utils/cache";
import { JUDGES, JudgeId } from "../utils/evaluator";
import { runValidate } from "./commands/validate";
import { runOptimize } from "./commands/optimize";
import { runJudge } from "./commands/judge";
import { runCacheStatus, runCacheClear } from "./commands/cache";
import { runCompare } from "./commands/compare";
import { runAB } from "./commands/ab";
import {
  Command,
  EngineType,
  TestBenchArgs,
  CATEGORIES,
  SMOKE_TEST_CASES,
  DEFAULT_MODEL_GEMINI,
  DEFAULT_MODEL_CODEX,
  discoverStrategies,
  filterTestCases,
  formatRelativeTime,
  computeTestCaseIntersection,
} from "./types";

export async function interactiveMode(): Promise<void> {
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
