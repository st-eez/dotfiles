import { engines } from "./utils/engines";

async function testEngines() {
  console.log("Starting engine tests...");

  const testPrompt = "Hello, world!";

  for (const engine of engines) {
    console.log(`\nTesting engine: ${engine.displayName}`);
    try {
      // We'll use a very simple prompt to just check connectivity/execution
      // Note: This will actually call the LLM, so it might cost money/tokens depending on the tool
      // For a safer test, we might just want to check if the binary exists, but 'run' executes the full command.
      // Let's try to run it.
      const result = await engine.run(testPrompt);
      console.log(`✅ Success! Output length: ${result.length}`);
      // console.log("Output:", result); // Uncomment to see full output
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed: ${message}`);
      const execError = error as { stderr?: string };
      if (execError.stderr) {
        console.error("Stderr:", execError.stderr);
      }
    }
  }

  console.log("\nTests completed.");
}

testEngines();
