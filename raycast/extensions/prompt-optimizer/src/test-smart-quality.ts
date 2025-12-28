#!/usr/bin/env npx ts-node

import "./setup-test";
import { engines, SmartModeResult, buildOptimizationPrompt } from "./utils/engines";
import { evaluate } from "./utils/evaluator";
import { runGemini } from "./test/lib/test-utils";
import { detectCommitteeRole } from "./test/lib/analysis";

const TEST_PROMPTS = [
  {
    id: "api-auth",
    prompt: "Write a REST API endpoint for user authentication with JWT tokens",
    context: "Using Express.js and PostgreSQL",
  },
  {
    id: "refactor-legacy",
    prompt: "Refactor this legacy codebase to use modern patterns",
    context: "Python 2.7 to Python 3.11 migration",
  },
  {
    id: "data-pipeline",
    prompt: "Design a real-time data pipeline for processing IoT sensor data",
    context: "Expected throughput: 10,000 events/second",
  },
];

async function runOldMultiCall(
  prompt: string,
  context: string,
  model = "gemini-3-flash-preview",
): Promise<{ result: SmartModeResult; duration: number }> {
  const start = Date.now();

  const classificationPrompt = `<system>
You are an intent classifier for a prompt optimization tool.
Analyze the user's request and determine which expert perspectives would produce the best optimized prompt.
</system>

<rules>
- Return ONLY valid JSON, no markdown
- Select 1-3 personas maximum
</rules>

<personas>
- prompt_engineer, software_engineer, architect, devops, security_auditor, product_manager, data_scientist, content_writer, researcher
</personas>

<output_format>
{"personas": ["id1", "id2"], "confidence": 0.9}
</output_format>

<user_request>${prompt}</user_request>
<additional_context>${context}</additional_context>`;

  const classifyOutput = await runGemini(classificationPrompt, { model });
  const classification = JSON.parse(classifyOutput.trim());
  const personasToRun: string[] = classification.personas?.length > 0 ? classification.personas : ["prompt_engineer"];

  const results = await Promise.all(
    personasToRun.map(async (p: string) => {
      const output = await runGemini(buildOptimizationPrompt(prompt, "quick", context, p), { model });
      return { persona: p, output };
    }),
  );

  let synthesis: string;
  if (results.length > 1) {
    const synthesisPrompt = `<system>
You are an expert synthesizer. Merge multiple specialized prompt perspectives into one cohesive, superior optimized prompt.
</system>

<rules>
- Preserve the BEST elements from each perspective
- Resolve conflicts by choosing the more specific/useful option
- Output a single unified prompt using standard XML format
</rules>

<perspectives>
${results.map((r) => `<${r.persona}>\n${r.output}\n</${r.persona}>`).join("\n")}
</perspectives>

<original_request>${prompt}</original_request>`;

    synthesis = (await runGemini(synthesisPrompt, { model })).trim();
  } else {
    synthesis = results[0].output;
  }

  return {
    result: { synthesis, perspectives: results, personasUsed: personasToRun },
    duration: (Date.now() - start) / 1000,
  };
}

async function runNewSPP(prompt: string, context: string): Promise<{ result: SmartModeResult; duration: number }> {
  const gemini = engines.find((e) => e.name === "gemini");
  if (!gemini?.runOrchestrated) throw new Error("Gemini engine not found");

  const start = Date.now();
  const result = await gemini.runOrchestrated(prompt, undefined, "quick", context);
  return { result, duration: (Date.now() - start) / 1000 };
}

async function main() {
  console.log("🧪 Smart Mode Quality Comparison: SPP vs Multi-Call\n");
  console.log("═".repeat(60));

  const results: Array<{
    testId: string;
    spp: { duration: number; score: number; personas: string[] };
    multiCall: { duration: number; score: number; personas: string[] };
  }> = [];

  for (const test of TEST_PROMPTS) {
    console.log(`\n📝 Test: ${test.id}`);
    console.log(`   Prompt: "${test.prompt.substring(0, 50)}..."`);

    console.log("\n   Running SPP (new)...");
    const sppResult = await runNewSPP(test.prompt, test.context);
    console.log(`   ✅ SPP done in ${sppResult.duration.toFixed(1)}s`);
    console.log(`      Personas: ${sppResult.result.personasUsed.join(", ")}`);

    console.log("\n   Running Multi-Call (old)...");
    const multiResult = await runOldMultiCall(test.prompt, test.context);
    console.log(`   ✅ Multi-Call done in ${multiResult.duration.toFixed(1)}s`);
    console.log(`      Personas: ${multiResult.result.personasUsed.join(", ")}`);

    console.log("\n   Evaluating quality...");
    const sppEval = await evaluate(test.id, "spp", test.prompt, test.context, sppResult.result.synthesis);
    const multiEval = await evaluate(test.id, "multi-call", test.prompt, test.context, multiResult.result.synthesis);

    results.push({
      testId: test.id,
      spp: { duration: sppResult.duration, score: sppEval.totalScore, personas: sppResult.result.personasUsed },
      multiCall: {
        duration: multiResult.duration,
        score: multiEval.totalScore,
        personas: multiResult.result.personasUsed,
      },
    });

    console.log(
      `   SPP Score: ${sppEval.totalScore.toFixed(1)} | Multi-Call Score: ${multiEval.totalScore.toFixed(1)}`,
    );

    const sppCommittee = detectCommitteeRole(sppResult.result.synthesis);
    const multiCommittee = detectCommitteeRole(multiResult.result.synthesis);

    if (sppCommittee.hasCommitteeRole) {
      console.log(`   ⚠️  SPP has committee-style role: "${sppCommittee.matchedPattern}"`);
    }
    if (multiCommittee.hasCommitteeRole) {
      console.log(`   ⚠️  Multi-Call has committee-style role: "${multiCommittee.matchedPattern}"`);
    }
  }

  console.log("\n" + "═".repeat(60));
  console.log("📊 SUMMARY");
  console.log("═".repeat(60));

  const sppAvgScore = results.reduce((sum, r) => sum + r.spp.score, 0) / results.length;
  const multiAvgScore = results.reduce((sum, r) => sum + r.multiCall.score, 0) / results.length;
  const sppAvgTime = results.reduce((sum, r) => sum + r.spp.duration, 0) / results.length;
  const multiAvgTime = results.reduce((sum, r) => sum + r.multiCall.duration, 0) / results.length;

  console.log(`\n| Metric          | SPP (new)   | Multi-Call (old) |`);
  console.log(`|-----------------|-------------|------------------|`);
  console.log(
    `| Avg Score       | ${sppAvgScore.toFixed(1).padStart(11)} | ${multiAvgScore.toFixed(1).padStart(16)} |`,
  );
  console.log(
    `| Avg Duration    | ${(sppAvgTime.toFixed(1) + "s").padStart(11)} | ${(multiAvgTime.toFixed(1) + "s").padStart(16)} |`,
  );
  console.log(`| Speedup         | ${(multiAvgTime / sppAvgTime).toFixed(1) + "x".padStart(10)} |                  |`);

  const scoreDiff = sppAvgScore - multiAvgScore;
  console.log(
    `\n${scoreDiff >= 0 ? "✅" : "⚠️"} Quality ${scoreDiff >= 0 ? "maintained" : "degraded"}: ${scoreDiff >= 0 ? "+" : ""}${scoreDiff.toFixed(1)} points`,
  );
  console.log(`⚡ Speed improvement: ${(multiAvgTime / sppAvgTime).toFixed(1)}x faster`);
}

main().catch(console.error);
