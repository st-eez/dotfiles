/**
 * LLM-as-Judge Evaluator for A/B Testing
 *
 * Uses GPT-5.2-Codex to evaluate optimized prompts against quality criteria.
 */

import { safeExec, withIsolatedCodex } from "./exec";

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

interface JudgeResponse {
  structure: boolean;
  context: boolean;
  clarity: number;
  actionability: number;
  completeness: number;
  rationale: string;
  synthesis: string;
}

// --- Constants ---

const EVALUATOR_MODEL = "gpt-5.2-codex";
const EVALUATOR_TIMEOUT_MS = 120_000;

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
function validateStructureLocally(output: string): boolean {
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
): Promise<EvaluationResult> {
  const tokenCount = estimateTokenCount(optimizedOutput);

  // Fast local validation - skip expensive LLM call if obviously malformed
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

    const rawOutput = await withIsolatedCodex(async (homeDir) => {
      return safeExec(
        "codex",
        ["exec", "-m", EVALUATOR_MODEL, "--config", 'model_reasoning_effort="high"', "--skip-git-repo-check"],
        evaluatorPrompt,
        EVALUATOR_TIMEOUT_MS,
        { CODEX_HOME: homeDir },
      );
    });

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
      totalScore = judgeResponse.clarity * 0.4 + judgeResponse.completeness * 0.3 + judgeResponse.actionability * 0.3;
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
