#!/usr/bin/env npx ts-node
import "./setup-test";
import { safeExec, withIsolatedGemini, withIsolatedCodex, parseGeminiJson } from "./utils/exec";
import { QUICK_TEST_CASES } from "./test-data/test-cases";
import { v1Baseline } from "./prompts/v1-baseline";

interface JudgeResult {
  engine: string;
  testCaseId: string;
  durationMs: number;
  parseSuccess: boolean;
  scores: { structure: boolean; context: boolean; clarity: number; actionability: number; completeness: number } | null;
  error?: string;
}

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
   
   5=all aspects captured, 3=core request addressed but minor details missing, 1=major aspects ignored
</task>

<original_prompt>
${originalPrompt}
</original_prompt>

${originalContext ? `<original_context>\n${originalContext}\n</original_context>` : "<original_context>None provided</original_context>"}

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

async function runGeminiJudge(prompt: string, testCaseId: string): Promise<JudgeResult> {
  const start = Date.now();
  try {
    const rawOutput = await withIsolatedGemini(async (homeDir) => {
      return safeExec("gemini", ["--model", "gemini-3-flash-preview", "--output-format", "json"], prompt, 60_000, {
        HOME: homeDir,
      });
    });
    const response = parseGeminiJson(rawOutput);
    const jsonStr = response.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    return {
      engine: "gemini-flash",
      testCaseId,
      durationMs: Date.now() - start,
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
      engine: "gemini-flash",
      testCaseId,
      durationMs: Date.now() - start,
      parseSuccess: false,
      scores: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runCodexJudge(prompt: string, testCaseId: string, effort: "high" | "medium"): Promise<JudgeResult> {
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
    const jsonStr = rawOutput.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    return {
      engine: `codex-${effort}`,
      testCaseId,
      durationMs: Date.now() - start,
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
      testCaseId,
      durationMs: Date.now() - start,
      parseSuccess: false,
      scores: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const testCases = QUICK_TEST_CASES.slice(0, 3);
  console.log(`🧪 Judge Comparison Test (${testCases.length} test cases)\n`);

  const allResults: JudgeResult[] = [];

  for (const tc of testCases) {
    console.log(`\n📝 Test Case: ${tc.id} - ${tc.description}`);

    const optimizedPrompt = v1Baseline.buildQuickPrompt(tc.userRequest, tc.additionalContext, tc.persona);

    console.log("  Running Gemini optimization...");
    const optimizedOutput = await withIsolatedGemini(async (homeDir) => {
      const raw = await safeExec(
        "gemini",
        ["--model", "gemini-3-flash-preview", "--output-format", "json"],
        optimizedPrompt,
        60_000,
        { HOME: homeDir },
      );
      return parseGeminiJson(raw);
    });

    const evalPrompt = buildEvaluatorPrompt(tc.userRequest, tc.additionalContext, optimizedOutput);

    console.log("  Judging with Gemini Flash...");
    const geminiResult = await runGeminiJudge(evalPrompt, tc.id);
    allResults.push(geminiResult);
    console.log(`    ${geminiResult.parseSuccess ? "✅" : "❌"} ${geminiResult.durationMs}ms`);

    console.log("  Judging with Codex Medium...");
    const codexMedResult = await runCodexJudge(evalPrompt, tc.id, "medium");
    allResults.push(codexMedResult);
    console.log(`    ${codexMedResult.parseSuccess ? "✅" : "❌"} ${codexMedResult.durationMs}ms`);

    console.log("  Judging with Codex High...");
    const codexHighResult = await runCodexJudge(evalPrompt, tc.id, "high");
    allResults.push(codexHighResult);
    console.log(`    ${codexHighResult.parseSuccess ? "✅" : "❌"} ${codexHighResult.durationMs}ms`);
  }

  console.log("\n" + "═".repeat(70));
  console.log("RESULTS BY TEST CASE");
  console.log("═".repeat(70));

  for (const tc of testCases) {
    console.log(`\n${tc.id}:`);
    const tcResults = allResults.filter((r) => r.testCaseId === tc.id);
    for (const r of tcResults) {
      if (r.parseSuccess && r.scores) {
        const total = r.scores.clarity + r.scores.actionability + r.scores.completeness;
        console.log(
          `  ${r.engine.padEnd(14)} | ${(r.durationMs / 1000).toFixed(1)}s | C:${r.scores.clarity} A:${r.scores.actionability} Co:${r.scores.completeness} = ${total}/15`,
        );
      } else {
        console.log(`  ${r.engine.padEnd(14)} | ${(r.durationMs / 1000).toFixed(1)}s | PARSE FAILED`);
      }
    }
  }

  console.log("\n" + "═".repeat(70));
  console.log("AGGREGATE STATS");
  console.log("═".repeat(70));

  const byEngine = new Map<string, JudgeResult[]>();
  for (const r of allResults) {
    if (!byEngine.has(r.engine)) byEngine.set(r.engine, []);
    byEngine.get(r.engine)!.push(r);
  }

  console.log("\n| Engine        | Avg Time | Parse Rate | Avg Total Score |");
  console.log("|---------------|----------|------------|-----------------|");

  for (const [engine, results] of byEngine) {
    const avgTime = results.reduce((a, r) => a + r.durationMs, 0) / results.length / 1000;
    const parseRate = results.filter((r) => r.parseSuccess).length / results.length;
    const successResults = results.filter((r) => r.parseSuccess && r.scores);
    const avgTotal =
      successResults.length > 0
        ? successResults.reduce((a, r) => a + r.scores!.clarity + r.scores!.actionability + r.scores!.completeness, 0) /
          successResults.length
        : 0;

    console.log(
      `| ${engine.padEnd(13)} | ${avgTime.toFixed(1)}s      | ${(parseRate * 100).toFixed(0)}%        | ${avgTotal.toFixed(1)}/15           |`,
    );
  }

  console.log("\n📊 SCORE AGREEMENT ANALYSIS");
  for (const tc of testCases) {
    const tcResults = allResults.filter((r) => r.testCaseId === tc.id && r.parseSuccess && r.scores);
    if (tcResults.length >= 2) {
      const totals = tcResults.map((r) => r.scores!.clarity + r.scores!.actionability + r.scores!.completeness);
      const max = Math.max(...totals);
      const min = Math.min(...totals);
      console.log(`  ${tc.id}: range ${min}-${max} (spread: ${max - min})`);
    }
  }

  console.log("\n");
}

main().catch(console.error);
