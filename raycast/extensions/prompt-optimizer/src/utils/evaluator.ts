/**
 * LLM-as-Judge Evaluator for A/B Testing
 *
 * Uses GPT-5.2-Codex to evaluate optimized prompts against quality criteria.
 */

import { safeExec, parseGeminiJson, parseOpencodeJson } from "./exec";
import { getCodexIsolation, getGeminiIsolation, getOpencodeIsolation } from "./isolation";
import { config } from "../config";
import { TimingData, RetryData, TokenData, OptimizationMetadata } from "./types";

export type { TimingData, RetryData, TokenData, OptimizationMetadata };

// --- Judge Configuration ---

export type JudgeEngine = "codex" | "gemini" | "opencode";

export interface JudgeConfig {
  engine: JudgeEngine;
  model: string;
  reasoningEffort?: "high" | "medium" | "low"; // codex only
}

export const JUDGES = {
  "codex-high": { engine: "codex" as const, model: "gpt-5.2-codex", reasoningEffort: "high" as const },
  "codex-medium": { engine: "codex" as const, model: "gpt-5.2-codex", reasoningEffort: "medium" as const },
  "gemini-flash": { engine: "gemini" as const, model: "gemini-3-flash-preview" },
  "gemini-pro": { engine: "gemini" as const, model: "gemini-3-pro-preview" },
  "grok-code": { engine: "opencode" as const, model: "opencode/grok-code" },
} as const;

export type JudgeId = keyof typeof JUDGES;

// --- Types ---

export interface EvaluationResult {
  testCaseId: string;
  version: string;
  structurePass: boolean;
  contextPass: boolean;
  clarityScore: number;
  actionabilityScore: number;
  completenessScore: number;
  totalScore: number;
  rationale: string;
  synthesis: string;
  rawOutput: string;
  tokenCount: number;
}

export interface EvaluationResultV3 extends EvaluationResult {
  schemaVersion: "3.0";
  optimization: OptimizationMetadata;
}

interface JudgeResponse {
  structure: boolean;
  context: boolean;
  clarity: number;
  actionability: number;
  completeness: number;
  rationale: string;
  synthesis: string;
}

// --- Evaluator Prompt ---

function buildEvaluatorPrompt(
  originalPrompt: string,
  originalContext: string | undefined,
  optimizedOutput: string,
): string {
  return `<system>
You are an expert prompt quality evaluator. Analyze the optimized prompt for quality and correctness.
</system>

<task>
Evaluate the following optimized prompt against these criteria:

1. **Structure Compliance** (binary): Does the output contain \`<role>\`, \`<objective>\`, AND **either** \`<instructions>\` OR \`<execution_protocol>\`?
2. **Context Preservation** (binary): If original context was provided, is it preserved verbatim (not summarized or altered) in the output's <reference_material> section?
3. **Instruction Clarity** (1-5): Are instructions unambiguous and specific?
4. **Actionability** (1-5): Can an LLM execute this prompt without needing clarification?
5. **Completeness** (1-5): Does the prompt capture all aspects of the original request?
   - Explicit requirements stated in the request
   - Implied constraints (format, scope, audience)
   - Edge cases or error handling if relevant
   - Expected output format
   
   5=all aspects captured, 3=core request addressed but minor details missing, 1=major aspects ignored
</task>

<original_prompt>
${originalPrompt}
</original_prompt>

${
  originalContext
    ? `<original_context>
${originalContext}
</original_context>`
    : "<original_context>None provided</original_context>"
}

<optimized_output>
${optimizedOutput}
</optimized_output>

<rules>
- Return ONLY valid JSON, no markdown fences
- For context preservation: if no original context was provided, set to true
- Structure: true only if ALL required tags are present
- Scores 1-5: 1=very poor, 2=poor, 3=adequate, 4=good, 5=excellent
- Synthesis: Extract or describe the role/persona from the <role> tag in 1-2 sentences
</rules>

<output_format>
{"structure": boolean, "context": boolean, "clarity": 1-5, "actionability": 1-5, "completeness": 1-5, "rationale": "Brief explanation of scores", "synthesis": "Description of the synthesized role"}
</output_format>`;
}

// --- Local Structure Validation ---

/**
 * Local structure validation before LLM evaluation.
 * Uses multiline regex to find tags at start of lines (avoiding false positives in code blocks).
 */
export function validateStructureLocally(output: string): boolean {
  // Match tags that appear at the start of a line (with optional whitespace)
  const hasRole = /^\s*<role>/im.test(output);
  const hasObjective = /^\s*<objective>/im.test(output);
  const hasInstructionsOrProtocol = /^\s*<instructions>/im.test(output) || /^\s*<execution_protocol>/im.test(output);
  return hasRole && hasObjective && hasInstructionsOrProtocol;
}

/**
 * Simple token approximation: ~4 chars per token
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

async function runCodexJudge(prompt: string, judge: JudgeConfig): Promise<string> {
  const reasoningConfig = judge.reasoningEffort ? `model_reasoning_effort="${judge.reasoningEffort}"` : "";
  const { env } = getCodexIsolation();
  return safeExec(
    "codex",
    ["exec", "-m", judge.model, ...(reasoningConfig ? ["--config", reasoningConfig] : []), "--skip-git-repo-check"],
    prompt,
    config.timeoutEvaluatorMs,
    env,
  );
}

async function runGeminiJudge(prompt: string, judge: JudgeConfig): Promise<string> {
  const { env } = getGeminiIsolation();
  const rawOutput = await safeExec(
    "gemini",
    ["--sandbox", "--model", judge.model, "--output-format", "json"],
    prompt,
    config.timeoutEvaluatorMs,
    env,
  );
  return parseGeminiJson(rawOutput);
}

async function runOpencodeJudge(prompt: string, judge: JudgeConfig): Promise<string> {
  const { env } = getOpencodeIsolation();
  const rawOutput = await safeExec(
    "opencode",
    ["run", "--model", judge.model, "--format", "json"],
    prompt,
    config.timeoutEvaluatorMs,
    env,
  );
  return parseOpencodeJson(rawOutput);
}

async function runJudge(prompt: string, judge: JudgeConfig): Promise<string> {
  if (judge.engine === "gemini") {
    return runGeminiJudge(prompt, judge);
  }
  if (judge.engine === "opencode") {
    return runOpencodeJudge(prompt, judge);
  }
  return runCodexJudge(prompt, judge);
}

// --- Main Evaluate Function ---

/**
 * Evaluate an optimized prompt using GPT-5.2-Codex as judge.
 *
 * Scoring logic:
 * - If local structure validation fails → early return with totalScore = 0
 * - If structure or context gate fails → totalScore = 0
 * - Otherwise: weighted average of (clarity*0.40 + completeness*0.30 + actionability*0.30)
 */
export async function evaluate(
  testCaseId: string,
  version: string,
  originalPrompt: string,
  originalContext: string | undefined,
  optimizedOutput: string,
  judge: JudgeConfig = JUDGES["codex-high"],
): Promise<EvaluationResult> {
  const tokenCount = estimateTokenCount(optimizedOutput);

  if (!validateStructureLocally(optimizedOutput)) {
    return {
      testCaseId,
      version,
      structurePass: false,
      contextPass: false,
      clarityScore: 0,
      actionabilityScore: 0,
      completenessScore: 0,
      totalScore: 0,
      rationale:
        "Failed local structure validation: missing required tags (<role>, <objective>, <instructions>/<execution_protocol>)",
      synthesis: "",
      rawOutput: "",
      tokenCount,
    };
  }

  try {
    const evaluatorPrompt = buildEvaluatorPrompt(originalPrompt, originalContext, optimizedOutput);

    const rawOutput = await runJudge(evaluatorPrompt, judge);

    const jsonStr = rawOutput.replace(/```json\n?|\n?```/g, "").trim();
    const judgeResponse: JudgeResponse = JSON.parse(jsonStr);

    // Gate check
    const structurePass = judgeResponse.structure;
    const contextPass = judgeResponse.context;
    const gatesFailed = !structurePass || !contextPass;

    // Calculate weighted score (clarity 40%, completeness 30%, actionability 30%)
    let totalScore: number;
    if (gatesFailed) {
      totalScore = 0;
    } else {
      totalScore =
        judgeResponse.clarity * config.weights.clarity +
        judgeResponse.completeness * config.weights.completeness +
        judgeResponse.actionability * config.weights.actionability;
    }

    return {
      testCaseId,
      version,
      structurePass,
      contextPass,
      clarityScore: judgeResponse.clarity,
      actionabilityScore: judgeResponse.actionability,
      completenessScore: judgeResponse.completeness,
      totalScore,
      rationale: judgeResponse.rationale,
      synthesis: judgeResponse.synthesis || "",
      rawOutput,
      tokenCount,
    };
  } catch (error) {
    // Return a failed evaluation on error
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      testCaseId,
      version,
      structurePass: false,
      contextPass: false,
      clarityScore: 0,
      actionabilityScore: 0,
      completenessScore: 0,
      totalScore: 0,
      rationale: `Evaluation failed: ${errorMessage}`,
      synthesis: "",
      rawOutput: "",
      tokenCount,
    };
  }
}

/**
 * Evaluate multiple outputs in a batch (used internally for parallel execution).
 */
export async function evaluateBatch(
  items: Array<{
    testCaseId: string;
    version: string;
    originalPrompt: string;
    originalContext: string | undefined;
    optimizedOutput: string;
  }>,
): Promise<EvaluationResult[]> {
  return Promise.all(
    items.map((item) =>
      evaluate(item.testCaseId, item.version, item.originalPrompt, item.originalContext, item.optimizedOutput),
    ),
  );
}

export async function evaluateWithMetadata(
  testCaseId: string,
  version: string,
  originalPrompt: string,
  originalContext: string | undefined,
  optimizedOutput: string,
  optimizationMeta: OptimizationMetadata,
  judge: JudgeConfig = JUDGES["codex-high"],
): Promise<EvaluationResultV3> {
  const baseResult = await evaluate(testCaseId, version, originalPrompt, originalContext, optimizedOutput, judge);

  return {
    ...baseResult,
    schemaVersion: "3.0",
    optimization: optimizationMeta,
  };
}
