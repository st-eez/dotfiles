import "./setup-test";
import { engines, SmartModeResult } from "./utils/engines";

async function testEngines() {
  console.log("Starting engine tests...\n");

  const testPrompt = "Hello, world!";

  for (const engine of engines) {
    console.log(`Testing engine: ${engine.displayName}`);
    try {
      const result = await engine.run(testPrompt);
      console.log(`✅ Success! Output length: ${result.length}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed: ${message}`);
    }
  }

  console.log("\n--- Smart Mode (SPP) Test ---\n");

  // Test Smart Mode with a more realistic prompt
  const smartPrompt = "Write a REST API endpoint for user authentication";
  const gemini = engines.find((e) => e.name === "gemini");

  if (gemini?.runOrchestrated) {
    console.log("Testing Smart Mode with Gemini...");
    console.log(`Prompt: "${smartPrompt}"\n`);

    const start = Date.now();
    try {
      const result: SmartModeResult = await gemini.runOrchestrated(smartPrompt, undefined, "quick", "");
      const duration = ((Date.now() - start) / 1000).toFixed(1);

      console.log(`✅ Smart Mode Success! Duration: ${duration}s`);
      console.log(`   Personas used: ${result.personasUsed.join(", ")}`);
      console.log(`   Perspectives: ${result.perspectives.length}`);
      result.perspectives.forEach((p) => {
        console.log(`     - ${p.persona}: ${p.output.length} chars`);
      });
      console.log(`   Synthesis: ${result.synthesis.length} chars`);
      console.log(`\n--- Synthesis Preview (first 300 chars) ---`);
      console.log(result.synthesis.substring(0, 300) + "...\n");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Smart Mode Failed: ${message}`);
    }
  }

  console.log("Tests completed.");
}

testEngines();
