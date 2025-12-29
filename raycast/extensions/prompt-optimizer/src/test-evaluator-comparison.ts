#!/usr/bin/env npx ts-node
/**
 * Quick validation: Compare Gemini vs Codex as evaluator/judge
 * Tests: speed, JSON parse success, score consistency
 */

import "./setup-test";
import { safeExec, withIsolatedGemini, withIsolatedCodex, parseGeminiJson } from "./utils/exec";

const SAMPLE_ORIGINAL = "Write a Python function to parse CSV files";
const SAMPLE_CONTEXT = undefined;
const SAMPLE_OUTPUT = `<role>
You are a senior Python developer specializing in data processing and file I/O operations.
</role>

<objective>
Create a robust, reusable Python function that parses CSV files with proper error handling and flexible configuration options.
</objective>

<instructions>
- Use the built-in csv module for parsing
- Support both file paths and file-like objects as input
- Handle common edge cases: empty files, malformed rows, different delimiters
- Return data as a list of dictionaries with header row as keys
- Include type hints for all parameters and return values
</instructions>`;

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

interface EvalResult {
  engine: string;
  durationMs: number;
  parseSuccess: boolean;
  scores: { structure: boolean; context: boolean; clarity: number; actionability: number; completeness: number } | null;
  error?: string;
}

async function runGeminiEval(): Promise<EvalResult> {
  const prompt = buildEvaluatorPrompt(SAMPLE_ORIGINAL, SAMPLE_CONTEXT, SAMPLE_OUTPUT);
  const start = Date.now();

  try {
    const rawOutput = await withIsolatedGemini(async (homeDir) => {
      return safeExec("gemini", ["--model", "gemini-3-flash-preview", "--output-format", "json"], prompt, 60_000, {
        HOME: homeDir,
      });
    });

    const durationMs = Date.now() - start;
    const response = parseGeminiJson(rawOutput);
    const jsonStr = response.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    return {
      engine: "gemini-3-flash",
      durationMs,
      parseSuccess: true,
      scores: {
        structure: parsed.structure,
        context: parsed.context,
        clarity: parsed.clarity,
        actionability: parsed.actionability,
        completeness: parsed.completeness,
      },
    };
  } catch (error) {
    return {
      engine: "gemini-3-flash",
      durationMs: Date.now() - start,
      parseSuccess: false,
      scores: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runCodexEval(effort: "high" | "medium"): Promise<EvalResult> {
  const prompt = buildEvaluatorPrompt(SAMPLE_ORIGINAL, SAMPLE_CONTEXT, SAMPLE_OUTPUT);
  const start = Date.now();

  try {
    const rawOutput = await withIsolatedCodex(async (homeDir) => {
      return safeExec(
        "codex",
        ["exec", "-m", "gpt-5.2-codex", "--config", `model_reasoning_effort="${effort}"`, "--skip-git-repo-check"],
        prompt,
        120_000,
        { CODEX_HOME: homeDir },
      );
    });

    const durationMs = Date.now() - start;
    const jsonStr = rawOutput.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    return {
      engine: `codex-${effort}`,
      durationMs,
      parseSuccess: true,
      scores: {
        structure: parsed.structure,
        context: parsed.context,
        clarity: parsed.clarity,
        actionability: parsed.actionability,
        completeness: parsed.completeness,
      },
    };
  } catch (error) {
    return {
      engine: `codex-${effort}`,
      durationMs: Date.now() - start,
      parseSuccess: false,
      scores: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log("🧪 Evaluator Comparison Test\n");
  console.log("Testing same prompt with different evaluator configs...\n");

  const results: EvalResult[] = [];

  // Run each evaluator
  console.log("Running Gemini Flash...");
  results.push(await runGeminiEval());
  console.log(`  Done in ${results[results.length - 1].durationMs}ms`);

  console.log("Running Codex Medium...");
  results.push(await runCodexEval("medium"));
  console.log(`  Done in ${results[results.length - 1].durationMs}ms`);

  console.log("Running Codex High...");
  results.push(await runCodexEval("high"));
  console.log(`  Done in ${results[results.length - 1].durationMs}ms`);

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("RESULTS");
  console.log("═".repeat(60));

  console.log("\n| Engine        | Time     | Parse | Clarity | Action | Complete |");
  console.log("|---------------|----------|-------|---------|--------|----------|");

  for (const r of results) {
    if (r.parseSuccess && r.scores) {
      console.log(
        `| ${r.engine.padEnd(13)} | ${(r.durationMs / 1000).toFixed(1).padStart(5)}s   | ✅    | ${r.scores.clarity}       | ${r.scores.actionability}      | ${r.scores.completeness}        |`,
      );
    } else {
      console.log(
        `| ${r.engine.padEnd(13)} | ${(r.durationMs / 1000).toFixed(1).padStart(5)}s   | ❌    | -       | -      | -        |`,
      );
      console.log(`|   Error: ${r.error?.slice(0, 50)}...`);
    }
  }

  // Speed comparison
  const gemini = results.find((r) => r.engine === "gemini-3-flash");
  const codexHigh = results.find((r) => r.engine === "codex-high");

  if (gemini && codexHigh && gemini.parseSuccess && codexHigh.parseSuccess) {
    const speedup = codexHigh.durationMs / gemini.durationMs;
    console.log(`\n📊 Gemini is ${speedup.toFixed(1)}x faster than Codex High`);
  }

  console.log("\n");
}

main().catch(console.error);
