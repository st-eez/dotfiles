import * as fs from "fs";
import * as path from "path";
import { JudgeId, EvaluationResultV3 } from "../utils/evaluator";
import { TEST_CASES, TestCase } from "../test-data/test-cases";
import { PromptStrategy } from "../prompts/types";

export type Command = "validate" | "optimize" | "judge" | "cache" | "compare" | "ab";
export type CacheSubcommand = "status" | "clear";
export type EngineType = "gemini" | "codex";

export interface TestBenchArgs {
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

export interface StrategyInfo {
  path: string;
  id: string;
  name: string;
}

export interface TestCaseIntersection {
  common: string[];
  onlyInBaseline: string[];
  onlyInCandidate: string[];
}

export interface ABComparisonEntry {
  testCaseId: string;
  baselineScore: number;
  candidateScore: number;
  delta: number;
}

export interface ABSummary {
  avgBaseline: number;
  avgCandidate: number;
  avgDelta: number;
  percentImprovement: number;
  baselineWins: number;
  candidateWins: number;
  ties: number;
  winner: "baseline" | "candidate" | "tie";
}

export interface OptimizeResult {
  testCaseId: string;
  status: "cached" | "optimized" | "error";
  durationMs?: number;
  error?: string;
}

export interface JudgeResultEntry {
  testCaseId: string;
  status: "success" | "no_cache" | "error";
  evaluation?: EvaluationResultV3;
  hasContext?: boolean;
  error?: string;
}

export const DEFAULT_ENGINE: EngineType = "gemini";
export const DEFAULT_MODEL_GEMINI = "gemini-3-flash-preview";
export const DEFAULT_MODEL_CODEX = "gpt-5.2-codex";
export const SMOKE_TEST_CASES = ["code-001", "write-001", "edge-001"];
export const CATEGORIES = [...new Set(TEST_CASES.map((tc) => tc.category))];

export function generatePrompt(strategy: PromptStrategy, testCase: TestCase): string {
  if (testCase.mode === "quick") {
    return strategy.buildQuickPrompt(testCase.userRequest, testCase.additionalContext, testCase.persona);
  } else {
    return strategy.buildDetailedPrompt(testCase.userRequest, testCase.additionalContext, testCase.persona);
  }
}

export function filterTestCases(caseIds?: string[], mode?: "quick" | "detailed", category?: string): TestCase[] {
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

export function computeTestCaseIntersection(baselineIds: string[], candidateIds: string[]): TestCaseIntersection {
  const baselineSet = new Set(baselineIds);
  const candidateSet = new Set(candidateIds);

  const common = baselineIds.filter((id) => candidateSet.has(id));
  const onlyInBaseline = baselineIds.filter((id) => !candidateSet.has(id));
  const onlyInCandidate = candidateIds.filter((id) => !baselineSet.has(id));

  return { common, onlyInBaseline, onlyInCandidate };
}

export function computeABSummary(results: ABComparisonEntry[]): ABSummary {
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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatRelativeTime(isoDate: string): string {
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

export async function loadStrategy(strategyPath: string): Promise<PromptStrategy> {
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

export async function discoverStrategies(): Promise<StrategyInfo[]> {
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
