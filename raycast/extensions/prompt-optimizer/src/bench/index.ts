import { parseArgs } from "./args";
import { interactiveMode } from "./interactive";
import { runValidate } from "./commands/validate";
import { runOptimize } from "./commands/optimize";
import { runJudge } from "./commands/judge";
import { runCacheStatus, runCacheClear } from "./commands/cache";
import { runCompare } from "./commands/compare";
import { runAB } from "./commands/ab";

export async function main(): Promise<void> {
  const args = parseArgs();

  if (!args) {
    await interactiveMode();
    return;
  }

  switch (args.command) {
    case "validate":
      await runValidate(args);
      break;
    case "optimize":
      await runOptimize(args);
      break;
    case "judge":
      await runJudge(args);
      break;
    case "cache":
      if (args.cacheSubcommand === "clear") {
        runCacheClear(args);
      } else {
        runCacheStatus();
      }
      break;
    case "compare":
      runCompare(args);
      break;
    case "ab":
      await runAB(args);
      break;
  }
}
