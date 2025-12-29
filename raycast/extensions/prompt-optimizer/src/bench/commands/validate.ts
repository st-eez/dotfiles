import { log, c, subheader, testResult } from "../../utils/cli-output";
import { validateStructureLocally } from "../../utils/evaluator";
import { TestBenchArgs, loadStrategy, filterTestCases, generatePrompt } from "../types";

export async function runValidate(args: TestBenchArgs): Promise<void> {
  if (!args.strategy) {
    log.error("--strategy is required for validate command");
    process.exit(1);
  }

  subheader(`Validating ${args.strategy}`);

  const strategy = await loadStrategy(args.strategy);
  const testCases = filterTestCases(args.cases, args.category);
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const prompt = generatePrompt(strategy, testCase);
      const hasStructure = validateStructureLocally(prompt);

      if (hasStructure) {
        testResult(testCase.id, true);
        passed++;
      } else {
        testResult(testCase.id, false, "Missing required tags (<role>, <objective>, <instructions>)");
        failed++;
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      testResult(testCase.id, false, msg);
      failed++;
    }
  }

  log.blank();
  log.plain(`${c.bold("Summary:")} ${passed}/${passed + failed} passed`);
  log.blank();
}
