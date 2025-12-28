#!/usr/bin/env npx ts-node

import "./setup-test";
import * as fs from "fs";
import * as path from "path";
import { TEST_CASES, TestCase } from "./test-data/test-cases";
import { evaluate, EvaluationResult } from "./utils/evaluator";
import { PromptStrategy } from "./prompts/types";
import { runWithEngine, withRetry, LLMRunOptions } from "./test/lib/test-utils";

// --- Types ---

interface ModelConfig {
  engine: "gemini" | "codex";
  model: string;
  label: string;
}

interface ComparisonResult {
  testCaseId: string;
  results: {
    [modelLabel: string]: EvaluationResult;
  };
}

interface ComparisonReport {
  schemaVersion: "1.0";
  timestamp: string;
  strategyId: string;
  testCaseCount: number;
  mode?: "quick" | "detailed";
  models: ModelConfig[];
  results: ComparisonResult[];
  summary: {
    [modelLabel: string]: {
      avgScore: number;
      structurePassRate: number;
      contextPassRate: number;
    };
  };
}

// --- Model Configurations ---

const MODEL_CONFIGS: ModelConfig[] = [
  { engine: "gemini", model: "gemini-3-flash-preview", label: "gemini-3-flash" },
  { engine: "gemini", model: "gemini-2.5-flash", label: "gemini-2.5-flash" },
  { engine: "codex", model: "gpt-5.2-codex", label: "gpt-5.2-codex" },
];

// --- CLI Argument Parsing ---

interface CLIArgs {
  strategy: string;
  testCases: number;
  mode?: "quick" | "detailed";
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const result: CLIArgs = {
    strategy: "",
    testCases: 5,
    mode: undefined,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--strategy":
        result.strategy = args[++i] || "";
        break;
      case "--test-cases":
        result.testCases = parseInt(args[++i] || "5", 10);
        break;
      case "--mode": {
        const modeArg = args[++i];
        if (modeArg === "quick" || modeArg === "detailed") {
          result.mode = modeArg;
        }
        break;
      }
      default:
        if (arg.startsWith("--")) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  if (!result.strategy) {
    console.error(
      "Usage: npx ts-node src/test-model-comparison.ts --strategy <path> [--test-cases <n>] [--mode quick|detailed]",
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

// --- Prompt Generation ---

function generatePrompt(strategy: PromptStrategy, testCase: TestCase): string {
  if (testCase.mode === "quick") {
    return strategy.buildQuickPrompt(testCase.userRequest, testCase.additionalContext, testCase.persona);
  } else {
    return strategy.buildDetailedPrompt(testCase.userRequest, testCase.additionalContext, testCase.persona);
  }
}

// --- Main ---

async function main(): Promise<void> {
  const startTime = Date.now();
  const args = parseArgs();

  console.log("🔬 Model Comparison Test\n");
  console.log("─".repeat(50));

  console.log("\n📦 Loading strategy...");
  let strategy: PromptStrategy;

  try {
    strategy = await loadStrategy(args.strategy);
    console.log(`  ✅ Strategy: ${strategy.id} - ${strategy.name}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Failed to load strategy: ${msg}`);
    process.exit(1);
  }

  let testCases = args.mode ? TEST_CASES.filter((tc) => tc.mode === args.mode) : TEST_CASES;
  testCases = testCases.slice(0, args.testCases);

  console.log(`\n📋 Running ${testCases.length} test cases across ${MODEL_CONFIGS.length} models...`);
  if (args.mode) console.log(`   Mode filter: ${args.mode}`);

  const results: ComparisonResult[] = [];

  for (const testCase of testCases) {
    console.log(`\n  Testing: ${testCase.id}`);
    const prompt = generatePrompt(strategy, testCase);
    const testResults: { [modelLabel: string]: EvaluationResult } = {};

    for (const config of MODEL_CONFIGS) {
      try {
        process.stdout.write(`    ${config.label}...`);
        const options: LLMRunOptions = { model: config.model };
        const output = await withRetry(() => runWithEngine(config.engine, prompt, options));
        const evaluation = await evaluate(
          testCase.id,
          strategy.id,
          testCase.userRequest,
          testCase.additionalContext,
          output,
        );
        testResults[config.label] = evaluation;
        console.log(` score=${evaluation.totalScore.toFixed(2)}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(` ❌ ${msg.slice(0, 50)}`);
        testResults[config.label] = {
          testCaseId: testCase.id,
          version: strategy.id,
          structurePass: false,
          contextPass: false,
          clarityScore: 0,
          actionabilityScore: 0,
          completenessScore: 0,
          totalScore: 0,
          rationale: `Error: ${msg}`,
          synthesis: "",
          rawOutput: "",
          tokenCount: 0,
        };
      }
    }

    results.push({ testCaseId: testCase.id, results: testResults });
  }

  // Calculate summary
  const summary: ComparisonReport["summary"] = {};
  for (const config of MODEL_CONFIGS) {
    const modelResults = results.map((r) => r.results[config.label]).filter(Boolean);
    const avgScore = modelResults.reduce((sum, r) => sum + r.totalScore, 0) / modelResults.length || 0;
    const structurePassRate = modelResults.filter((r) => r.structurePass).length / modelResults.length || 0;
    const contextPassRate = modelResults.filter((r) => r.contextPass).length / modelResults.length || 0;
    summary[config.label] = {
      avgScore,
      structurePassRate,
      contextPassRate,
    };
  }

  const durationSeconds = (Date.now() - startTime) / 1000;

  const report: ComparisonReport = {
    schemaVersion: "1.0",
    timestamp: new Date().toISOString(),
    strategyId: strategy.id,
    testCaseCount: testCases.length,
    mode: args.mode,
    models: MODEL_CONFIGS,
    results,
    summary,
  };

  const reportDir = path.join(process.cwd(), "ab_results");
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(reportDir, `model_comparison_${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: ${reportPath}`);

  console.log("\n" + "═".repeat(50));
  console.log("📊 SUMMARY");
  console.log("═".repeat(50));
  console.log(`Duration: ${durationSeconds.toFixed(1)}s`);
  console.log(`Test cases: ${testCases.length}`);
  console.log("");

  console.log("Model Performance:");
  for (const config of MODEL_CONFIGS) {
    const s = summary[config.label];
    console.log(
      `  ${config.label.padEnd(20)} avg=${s.avgScore.toFixed(2)} structure=${(s.structurePassRate * 100).toFixed(0)}% context=${(s.contextPassRate * 100).toFixed(0)}%`,
    );
  }

  const bestModel = MODEL_CONFIGS.reduce((best, config) =>
    summary[config.label].avgScore > summary[best.label].avgScore ? config : best,
  );
  console.log(
    `\n🏆 Best performing model: ${bestModel.label} (avg score: ${summary[bestModel.label].avgScore.toFixed(2)})`,
  );

  console.log("");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
