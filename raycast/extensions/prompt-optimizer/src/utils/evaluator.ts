/**
 * LLM-as-Judge Evaluator for A/B Testing
 *
 * Uses GPT-5.2-Codex to evaluate optimized prompts against quality criteria.
 */

import { safeExec } from "./exec";

// --- Types ---

export interface EvaluationResult {
  testCaseId: string;
  version: string;
  structurePass: boolean;
  contextPass: boolean;
  clarityScore: number;
  actionabilityScore: number;
  concisenessScore: number;
  efficiencyScore: number;
  totalScore: number;
  rationale: string;
  rawOutput: string;
  tokenCount: number;
}

interface JudgeResponse {
  structure: boolean;
  context: boolean;
  clarity: number;
  actionability: number;
  conciseness: number;
  rationale: string;
}

// --- Constants ---

const EVALUATOR_MODEL = "gpt-5.2-codex";
const EVALUATOR_TIMEOUT_MS = 120_000;

const REQUIRED_XML_TAGS = ["<role>", "<objective>", "<instructions>"];

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

1. **Structure Compliance** (binary): Does the output contain these required XML tags: ${REQUIRED_XML_TAGS.join(", ")}?
2. **Context Preservation** (binary): If original context was provided, is it preserved verbatim (not summarized or altered) in the output's <reference_material> section?
3. **Instruction Clarity** (1-5): Are instructions unambiguous and specific?
4. **Actionability** (1-5): Can an LLM execute this prompt without needing clarification?
5. **Conciseness** (1-5): Does the prompt use minimal words for maximum clarity?
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
</rules>

<output_format>
{"structure": boolean, "context": boolean, "clarity": 1-5, "actionability": 1-5, "conciseness": 1-5, "rationale": "Brief explanation of scores"}
</output_format>`;
}

// --- Token Efficiency Calculation ---

/**
 * Calculate efficiency score based on length ratio.
 * Shorter or equal = 5, up to 2x longer = 2, beyond 2x = 1
 */
function calculateEfficiency(baselineTokens: number, candidateTokens: number): number {
  if (baselineTokens === 0) return 5;
  const ratio = candidateTokens / baselineTokens;
  if (ratio <= 1) return 5;
  if (ratio <= 1.2) return 4;
  if (ratio <= 1.5) return 3;
  if (ratio <= 2.0) return 2;
  return 1;
}

/**
 * Simple token approximation: ~4 chars per token
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

// --- Main Evaluate Function ---

/**
 * Evaluate an optimized prompt using GPT-5.2-Codex as judge.
 *
 * Scoring logic:
 * - If structure or context gate fails → totalScore = 0
 * - Otherwise: weighted average of (clarity*0.35 + actionability*0.35 + conciseness*0.20 + efficiency*0.10)
 */
export async function evaluate(
  testCaseId: string,
  version: string,
  originalPrompt: string,
  originalContext: string | undefined,
  optimizedOutput: string,
  baselineTokenCount?: number,
): Promise<EvaluationResult> {
  const tokenCount = estimateTokenCount(optimizedOutput);

  // Calculate efficiency (default baseline to same as candidate if not provided)
  const efficiencyScore = baselineTokenCount ? calculateEfficiency(baselineTokenCount, tokenCount) : 5;

  try {
    const evaluatorPrompt = buildEvaluatorPrompt(originalPrompt, originalContext, optimizedOutput);

    const rawOutput = await safeExec(
      "codex",
      ["exec", "-m", EVALUATOR_MODEL, "--config", 'model_reasoning_effort="high"', "--skip-git-repo-check"],
      evaluatorPrompt,
      EVALUATOR_TIMEOUT_MS,
    );

    // Parse JSON response
    const jsonStr = rawOutput.replace(/```json\n?|\n?```/g, "").trim();
    const judgeResponse: JudgeResponse = JSON.parse(jsonStr);

    // Gate check
    const structurePass = judgeResponse.structure;
    const contextPass = judgeResponse.context;
    const gatesFailed = !structurePass || !contextPass;

    // Calculate weighted score
    let totalScore: number;
    if (gatesFailed) {
      totalScore = 0;
    } else {
      totalScore =
        judgeResponse.clarity * 0.35 +
        judgeResponse.actionability * 0.35 +
        judgeResponse.conciseness * 0.2 +
        efficiencyScore * 0.1;
    }

    return {
      testCaseId,
      version,
      structurePass,
      contextPass,
      clarityScore: judgeResponse.clarity,
      actionabilityScore: judgeResponse.actionability,
      concisenessScore: judgeResponse.conciseness,
      efficiencyScore,
      totalScore,
      rationale: judgeResponse.rationale,
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
      concisenessScore: 0,
      efficiencyScore,
      totalScore: 0,
      rationale: `Evaluation failed: ${errorMessage}`,
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
    baselineTokenCount?: number;
  }>,
): Promise<EvaluationResult[]> {
  return Promise.all(
    items.map((item) =>
      evaluate(
        item.testCaseId,
        item.version,
        item.originalPrompt,
        item.originalContext,
        item.optimizedOutput,
        item.baselineTokenCount,
      ),
    ),
  );
}
