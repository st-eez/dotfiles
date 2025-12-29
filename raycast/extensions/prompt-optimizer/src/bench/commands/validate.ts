import color from "picocolors";
import { validateStructureLocally } from "../../utils/evaluator";
import { TestBenchArgs, loadStrategy, filterTestCases, generatePrompt } from "../types";

export async function runValidate(args: TestBenchArgs): Promise<void> {
  if (!args.strategy) {
    console.error("Error: --strategy is required for validate command");
    process.exit(1);
  }

  console.log(`\n${color.cyan("Validating")} ${args.strategy}...\n`);

  const strategy = await loadStrategy(args.strategy);
  const testCases = filterTestCases(args.cases, args.mode, args.category);
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const prompt = generatePrompt(strategy, testCase);
      const hasStructure = validateStructureLocally(prompt);

      if (hasStructure) {
        console.log(`  ${color.green("✓")} ${testCase.id}`);
        passed++;
      } else {
        console.log(`  ${color.red("✗")} ${testCase.id} - Missing required tags (<role>, <objective>, <instructions>)`);
        failed++;
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ${color.red("✗")} ${testCase.id} - ${msg}`);
      failed++;
    }
  }

  console.log(`\n${color.bold("Summary:")} ${passed}/${passed + failed} passed\n`);
}
