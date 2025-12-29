/**
 * CLI Args - Common argument parsing for CLI test scripts.
 * Provides --json, --quiet, --verbose, --no-color, --ascii flags.
 */

import { configureOutput, env, log, isJsonMode } from "./cli-output";
import type { CommonCliArgs, OutputMode } from "./cli-types";

// ============================================================================
// Argument Parsing
// ============================================================================

export function parseCommonArgs(argv: string[] = process.argv): CommonCliArgs {
  const args: CommonCliArgs = {};

  for (const arg of argv) {
    switch (arg) {
      case "--json":
        args.json = true;
        break;
      case "--quiet":
      case "-q":
        args.quiet = true;
        break;
      case "--verbose":
      case "-v":
        args.verbose = true;
        break;
      case "--no-color":
      case "--no-colors":
        args.noColor = true;
        break;
      case "--ascii":
        args.ascii = true;
        break;
      case "--simple":
        args.simple = true;
        break;
    }
  }

  return args;
}

export function applyCommonArgs(args: CommonCliArgs): void {
  let mode: OutputMode = "normal";

  if (args.json) {
    mode = "json";
  } else if (args.quiet) {
    mode = "quiet";
  } else if (args.verbose) {
    mode = "verbose";
  }

  configureOutput({
    mode,
    noColor: args.noColor ?? env.noColor,
    ascii: args.ascii ?? !env.supportsUnicode,
    simple: args.simple ?? false,
  });
}

export function initCliOutput(argv: string[] = process.argv): CommonCliArgs {
  const args = parseCommonArgs(argv);
  const errors = validateArgs(args);

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`Error: ${error}`);
    }
    process.exit(1);
  }

  applyCommonArgs(args);
  return args;
}

// ============================================================================
// Help Text
// ============================================================================

export function getCommonArgsHelp(): string {
  return `
Output Options:
  --json          Output results as JSON (implies --quiet for logs)
  --quiet, -q     Suppress non-error output
  --verbose, -v   Enable debug logging
  --no-color      Disable colored output
  --ascii         Use ASCII characters instead of Unicode
  --simple        Linear output without animations (accessibility/CI friendly)
`.trim();
}

export function isHelpRequested(argv: string[] = process.argv): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

export function hasFlag(flag: string, argv: string[] = process.argv): boolean {
  return argv.includes(flag) || argv.includes(`--${flag}`);
}

export function getFlagValue(flag: string, argv: string[] = process.argv): string | undefined {
  const prefix = `--${flag}=`;
  const prefixArg = argv.find((arg) => arg.startsWith(prefix));
  if (prefixArg) {
    return prefixArg.slice(prefix.length);
  }

  const flagIndex = argv.indexOf(`--${flag}`);
  if (flagIndex !== -1 && flagIndex + 1 < argv.length) {
    const nextArg = argv[flagIndex + 1];
    if (!nextArg.startsWith("-")) {
      return nextArg;
    }
  }

  return undefined;
}

// ============================================================================
// Validation
// ============================================================================

export function validateArgs(args: CommonCliArgs): string[] {
  const errors: string[] = [];

  const modeFlags = [args.json, args.quiet, args.verbose].filter(Boolean).length;
  if (modeFlags > 1) {
    errors.push("Cannot combine --json, --quiet, and --verbose flags");
  }

  return errors;
}

export function validateRequiredArg(
  name: string,
  value: string | undefined,
  allowedValues?: string[],
): string | undefined {
  if (!value) {
    return `Missing required argument: --${name}`;
  }

  if (allowedValues && !allowedValues.includes(value)) {
    return `Invalid value for --${name}: ${value}. Allowed: ${allowedValues.join(", ")}`;
  }

  return undefined;
}

// ============================================================================
// Non-Interactive Mode
// ============================================================================

export function isNonInteractive(): boolean {
  if (env.isCI) return true;
  if (!env.isTTY) return true;
  if (isJsonMode()) return true;
  return false;
}

export function requireInteractive(feature: string): void {
  if (isNonInteractive()) {
    log.error(`${feature} requires an interactive terminal`);

    if (env.isCI) {
      log.error("Detected CI environment - interactive prompts are disabled");
    } else if (!env.isTTY) {
      log.error("stdin/stdout is not a TTY - interactive prompts are disabled");
    } else if (isJsonMode()) {
      log.error("JSON mode enabled - interactive prompts are disabled");
    }

    process.exit(1);
  }
}

export function warnNonInteractive(feature: string): boolean {
  if (isNonInteractive()) {
    log.warn(`${feature} skipped - non-interactive mode`);
    return true;
  }
  return false;
}

// ============================================================================
// Convenience Exports
// ============================================================================

export { configureOutput, getOutputOptions, isJsonMode, isQuietMode, isVerboseMode, isSimpleMode } from "./cli-output";
