import color from "picocolors";
import { JUDGES, JudgeId } from "../utils/evaluator";
import { Command, TestBenchArgs, CATEGORIES } from "./types";

export function printUsage(): void {
  console.log(`
${color.bold("Test Bench - Prompt Optimization Testing Infrastructure")}

${color.cyan("Usage:")}
  npx ts-node src/test-bench.ts <command> [options]
  npx ts-node src/test-bench.ts                    (interactive mode)

${color.cyan("Commands:")}
  validate   Syntax check - verify strategy code runs without errors (FREE, no LLM)
  optimize   Run LLM to generate optimized prompts, cache results to disk
  judge      Score cached outputs using LLM-as-judge
  ab         A/B compare two cached optimization runs (costs $)
  cache      Manage disk cache (status/clear)
  compare    Diff two result files side-by-side

${color.cyan("Options:")}
  --strategy <path>    Strategy file path (e.g., src/prompts/v1-baseline.ts)
  --case <id>          Specific test case ID (can be repeated)
  --mode <mode>        Filter test cases: quick or detailed
  --category <name>    Filter by category: ${CATEGORIES.join(", ")}
  --engine <name>      Engine: gemini or codex (default: gemini)
  --model <name>       Model override
  --reasoning <level>  Codex reasoning: high, medium, low (default: high)
  --judge <name>       Judge: ${Object.keys(JUDGES).join(", ")}
  --force              Bypass cache and regenerate
  --all                Clear all cache entries
  --runs <f1> <f2>     Two result files to compare
  --concurrency <n>    Parallel API calls (default: 3, max: 10)
  --baseline <run>     Baseline cached run for A/B (e.g., v1-baseline_gemini_gemini-3-flash-preview)
  --candidate <run>    Candidate cached run for A/B comparison

${color.cyan("Examples:")}
  npx ts-node src/test-bench.ts validate --strategy src/prompts/v1-baseline.ts
  npx ts-node src/test-bench.ts optimize --strategy src/prompts/v1-baseline.ts --case code-001
  npx ts-node src/test-bench.ts judge --strategy src/prompts/v1-baseline.ts --judge gemini-flash
  npx ts-node src/test-bench.ts cache status
  npx ts-node src/test-bench.ts cache clear --strategy v1-baseline
  npx ts-node src/test-bench.ts ab --baseline v1-baseline_gemini_gemini-3-flash-preview --candidate v2-lean_codex_gpt-5.2-codex --judge codex-high
`);
}

export function parseArgs(): TestBenchArgs | null {
  const args = process.argv.slice(2);

  if (args.length === 0) return null;
  if (args[0] === "--help" || args[0] === "-h") {
    printUsage();
    process.exit(0);
  }

  const command = args[0] as Command;
  if (!["validate", "optimize", "judge", "cache", "compare", "ab"].includes(command)) {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }

  const result: TestBenchArgs = { command };
  const cases: string[] = [];

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--strategy":
        result.strategy = args[++i];
        break;
      case "--case":
        cases.push(args[++i]);
        break;
      case "--mode": {
        const modeArg = args[++i];
        if (modeArg === "quick" || modeArg === "detailed") {
          result.mode = modeArg;
        }
        break;
      }
      case "--category":
        result.category = args[++i];
        break;
      case "--engine": {
        const engineArg = args[++i];
        if (engineArg === "gemini" || engineArg === "codex") {
          result.engine = engineArg;
        }
        break;
      }
      case "--model":
        result.model = args[++i];
        break;
      case "--reasoning": {
        const reasoningArg = args[++i] as "high" | "medium" | "low";
        if (["high", "medium", "low"].includes(reasoningArg)) {
          result.reasoning = reasoningArg;
        }
        break;
      }
      case "--judge": {
        const judgeArg = args[++i] as JudgeId;
        if (judgeArg in JUDGES) {
          result.judge = judgeArg;
        } else {
          console.error(`Unknown judge: ${judgeArg}. Valid: ${Object.keys(JUDGES).join(", ")}`);
          process.exit(1);
        }
        break;
      }
      case "--force":
        result.force = true;
        break;
      case "--all":
        result.all = true;
        break;
      case "--runs":
        result.runs = [args[++i], args[++i]];
        break;
      case "--concurrency": {
        const concurrency = parseInt(args[++i], 10);
        if (!isNaN(concurrency) && concurrency >= 1 && concurrency <= 10) {
          result.concurrency = concurrency;
        } else {
          console.warn("Concurrency must be 1-10, using default (3)");
        }
        break;
      }
      case "--baseline":
        result.baselineRun = args[++i];
        break;
      case "--candidate":
        result.candidateRun = args[++i];
        break;
      case "status":
      case "clear":
        if (command === "cache") {
          result.cacheSubcommand = arg;
        }
        break;
      default:
        if (arg.startsWith("--")) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  if (cases.length > 0) result.cases = cases;
  return result;
}
