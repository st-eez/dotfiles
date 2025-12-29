/**
 * CLI Output - Centralized output module for CLI test scripts.
 * Provides consistent logging, symbols, colors, headers, and formatting.
 */

import pc from "picocolors";
import type { CliEnvironment, OutputOptions, SymbolSet, LogLevel, FailureRecord } from "./cli-types";

// ============================================================================
// Environment Detection
// ============================================================================

function detectEnvironment(): CliEnvironment {
  const noColor = !!(process.env.NO_COLOR || process.env.NO_COLORS || process.env.COLOR === "0");
  const forceColor = !!(
    process.env.FORCE_COLOR ||
    process.env.FORCE_COLORS ||
    process.env.COLOR === "1" ||
    process.env.COLORS === "1"
  );

  const isCI = !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.TRAVIS ||
    process.env.JENKINS_URL ||
    process.env.BUILDKITE
  );

  const isTTY = process.stdout.isTTY ?? false;

  const columns = process.stdout.columns || 80;

  const supportsUnicode = !process.env.TERM?.includes("dumb") && process.platform !== "win32";

  return {
    isTTY,
    isCI,
    noColor,
    forceColor,
    columns,
    supportsUnicode,
  };
}

export const env: CliEnvironment = detectEnvironment();

// ============================================================================
// Output Options
// ============================================================================

let outputOptions: OutputOptions = {
  mode: "normal",
  noColor: env.noColor && !env.forceColor,
  ascii: !env.supportsUnicode,
};

export function configureOutput(options: Partial<OutputOptions>): void {
  outputOptions = { ...outputOptions, ...options };
}

export function getOutputOptions(): OutputOptions {
  return { ...outputOptions };
}

export function colorsEnabled(): boolean {
  if (outputOptions.noColor) return false;
  if (env.forceColor) return true;
  return !env.noColor;
}

export function isJsonMode(): boolean {
  return outputOptions.mode === "json";
}

export function isQuietMode(): boolean {
  return outputOptions.mode === "quiet";
}

export function isVerboseMode(): boolean {
  return outputOptions.mode === "verbose";
}

// ============================================================================
// Symbols
// ============================================================================

const UNICODE_SYMBOLS: SymbolSet = {
  ok: "✔",
  fail: "✖",
  warn: "⚠",
  info: "ℹ",
  arrow: "→",
  running: "◐",
  pending: "○",
  skip: "⊘",
  bullet: "●",
  dash: "─",
  ellipsis: "…",
};

const ASCII_SYMBOLS: SymbolSet = {
  ok: "[OK]",
  fail: "[X]",
  warn: "[!]",
  info: "[i]",
  arrow: "->",
  running: "[~]",
  pending: "[ ]",
  skip: "[-]",
  bullet: "*",
  dash: "-",
  ellipsis: "...",
};

function getSymbolSet(): SymbolSet {
  return outputOptions.ascii ? ASCII_SYMBOLS : UNICODE_SYMBOLS;
}

function coloredSymbol(symbol: string, colorFn: (s: string) => string): string {
  return colorsEnabled() ? colorFn(symbol) : symbol;
}

export const symbols = {
  get ok(): string {
    return coloredSymbol(getSymbolSet().ok, pc.green);
  },
  get fail(): string {
    return coloredSymbol(getSymbolSet().fail, pc.red);
  },
  get warn(): string {
    return coloredSymbol(getSymbolSet().warn, pc.yellow);
  },
  get info(): string {
    return coloredSymbol(getSymbolSet().info, pc.blue);
  },
  get arrow(): string {
    return coloredSymbol(getSymbolSet().arrow, pc.cyan);
  },
  get running(): string {
    return coloredSymbol(getSymbolSet().running, pc.cyan);
  },
  get pending(): string {
    return getSymbolSet().pending;
  },
  get skip(): string {
    return coloredSymbol(getSymbolSet().skip, pc.gray);
  },
  get bullet(): string {
    return getSymbolSet().bullet;
  },
  get dash(): string {
    return getSymbolSet().dash;
  },
  get ellipsis(): string {
    return getSymbolSet().ellipsis;
  },
};

// ============================================================================
// Text Utilities
// ============================================================================

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

export function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, "");
}

export function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

export function truncate(str: string, maxLen: number, ellipsis = "…"): string {
  const visible = stripAnsi(str);
  if (visible.length <= maxLen) return str;

  const ellipsisLen = outputOptions.ascii ? 3 : 1;
  const targetLen = maxLen - ellipsisLen;
  if (targetLen <= 0) return outputOptions.ascii ? "..." : "…";

  let visibleCount = 0;
  let result = "";

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (char === "\x1b") {
      // eslint-disable-next-line no-control-regex
      const match = str.slice(i).match(/^\x1b\[[0-9;]*m/);
      if (match) {
        result += match[0];
        i += match[0].length - 1;
        continue;
      }
    }

    if (visibleCount >= targetLen) break;
    result += char;
    visibleCount++;
  }

  return result + (outputOptions.ascii ? "..." : ellipsis);
}

export function padEnd(str: string, len: number, fillChar = " "): string {
  const visible = visibleLength(str);
  if (visible >= len) return str;
  return str + fillChar.repeat(len - visible);
}

export function padStart(str: string, len: number, fillChar = " "): string {
  const visible = visibleLength(str);
  if (visible >= len) return str;
  return fillChar.repeat(len - visible) + str;
}

export function getTerminalWidth(): number {
  return env.columns;
}

// ============================================================================
// Color Wrappers
// ============================================================================

function wrapColor(colorFn: (s: string) => string): (s: string) => string {
  return (s: string) => (colorsEnabled() ? colorFn(s) : s);
}

export const c = {
  bold: wrapColor(pc.bold),
  dim: wrapColor(pc.dim),
  italic: wrapColor(pc.italic),
  underline: wrapColor(pc.underline),
  inverse: wrapColor(pc.inverse),
  strikethrough: wrapColor(pc.strikethrough),
  red: wrapColor(pc.red),
  green: wrapColor(pc.green),
  yellow: wrapColor(pc.yellow),
  blue: wrapColor(pc.blue),
  magenta: wrapColor(pc.magenta),
  cyan: wrapColor(pc.cyan),
  white: wrapColor(pc.white),
  gray: wrapColor(pc.gray),
  bgRed: wrapColor(pc.bgRed),
  bgGreen: wrapColor(pc.bgGreen),
  bgYellow: wrapColor(pc.bgYellow),
  bgBlue: wrapColor(pc.bgBlue),
  bgMagenta: wrapColor(pc.bgMagenta),
  bgCyan: wrapColor(pc.bgCyan),
};

// ============================================================================
// Logging
// ============================================================================

const logBuffer: Array<{ level: LogLevel; message: string; timestamp: Date; data?: Record<string, unknown> }> = [];

function shouldLog(level: LogLevel): boolean {
  if (isJsonMode()) return false;
  if (isQuietMode() && level !== "error") return false;
  if (level === "debug" && !isVerboseMode()) return false;
  return true;
}

function formatLogPrefix(level: LogLevel): string {
  switch (level) {
    case "debug":
      return c.dim("[debug]");
    case "info":
      return c.blue(symbols.info);
    case "success":
      return symbols.ok;
    case "warn":
      return symbols.warn;
    case "error":
      return symbols.fail;
    default:
      return "";
  }
}

function logMessage(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  logBuffer.push({ level, message, timestamp: new Date(), data });

  if (!shouldLog(level)) return;

  const prefix = formatLogPrefix(level);
  const output = prefix ? `${prefix} ${message}` : message;

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const log = {
  debug: (message: string, data?: Record<string, unknown>) => logMessage("debug", message, data),
  info: (message: string, data?: Record<string, unknown>) => logMessage("info", message, data),
  success: (message: string, data?: Record<string, unknown>) => logMessage("success", message, data),
  warn: (message: string, data?: Record<string, unknown>) => logMessage("warn", message, data),
  error: (message: string, data?: Record<string, unknown>) => logMessage("error", message, data),

  plain: (message: string): void => {
    if (isJsonMode() || isQuietMode()) return;
    console.log(message);
  },

  blank: (): void => {
    if (isJsonMode() || isQuietMode()) return;
    console.log();
  },

  getBuffer: () => [...logBuffer],
  clearBuffer: () => {
    logBuffer.length = 0;
  },
};

// ============================================================================
// Headers & Sections
// ============================================================================

export function header(title: string, width?: number): void {
  if (isJsonMode() || isQuietMode()) return;

  const termWidth = width ?? Math.min(getTerminalWidth(), 80);
  const line = (outputOptions.ascii ? "=" : "═").repeat(termWidth);

  console.log();
  console.log(c.bold(line));
  console.log(c.bold(padEnd(` ${title}`, termWidth)));
  console.log(c.bold(line));
}

export function subheader(title: string, width?: number): void {
  if (isJsonMode() || isQuietMode()) return;

  const termWidth = width ?? Math.min(getTerminalWidth(), 80);
  const line = (outputOptions.ascii ? "-" : "─").repeat(termWidth);

  console.log();
  console.log(c.bold(title));
  console.log(c.dim(line));
}

export function divider(width?: number): void {
  if (isJsonMode() || isQuietMode()) return;

  const termWidth = width ?? Math.min(getTerminalWidth(), 80);
  const line = (outputOptions.ascii ? "-" : "─").repeat(termWidth);
  console.log(c.dim(line));
}

export function labeledHeader(label: string, bgColor: "green" | "red" | "yellow" | "blue" | "magenta" = "blue"): void {
  if (isJsonMode() || isQuietMode()) return;

  const colorFn = {
    green: c.bgGreen,
    red: c.bgRed,
    yellow: c.bgYellow,
    blue: c.bgBlue,
    magenta: c.bgMagenta,
  }[bgColor];

  console.log();
  console.log(colorFn(c.bold(` ${label} `)));
}

// ============================================================================
// Status Output
// ============================================================================

export function testResult(id: string, passed: boolean, details?: string): void {
  if (isJsonMode()) return;

  const symbol = passed ? symbols.ok : symbols.fail;
  const coloredId = passed ? c.green(id) : c.red(id);
  const detailsStr = details ? c.dim(` - ${details}`) : "";

  console.log(`  ${symbol} ${coloredId}${detailsStr}`);
}

export function testRunning(id: string, phase?: string): void {
  if (isJsonMode()) return;

  const phaseStr = phase ? c.dim(` (${phase})`) : "";
  console.log(`  ${symbols.running} ${c.cyan(id)}${phaseStr}`);
}

export function testSkipped(id: string, reason?: string): void {
  if (isJsonMode()) return;

  const reasonStr = reason ? c.dim(` - ${reason}`) : "";
  console.log(`  ${symbols.skip} ${c.gray(id)}${reasonStr}`);
}

// ============================================================================
// Key-Value Output
// ============================================================================

export function keyValue(label: string, value: string | number, indent = 0): void {
  if (isJsonMode() || isQuietMode()) return;

  const indentStr = " ".repeat(indent);
  console.log(`${indentStr}${c.dim(label + ":")} ${value}`);
}

export function keyValueInline(pairs: Array<[string, string | number]>, separator = "  |  "): void {
  if (isJsonMode() || isQuietMode()) return;

  const formatted = pairs.map(([label, value]) => `${c.dim(label + ":")} ${value}`).join(separator);
  console.log(formatted);
}

// ============================================================================
// Failure Collection
// ============================================================================

const failures: FailureRecord[] = [];

export function recordFailure(failure: FailureRecord): void {
  failures.push(failure);
}

export function getFailures(): FailureRecord[] {
  return [...failures];
}

export function clearFailures(): void {
  failures.length = 0;
}

export function printFailureSummary(): void {
  if (isJsonMode()) return;
  if (failures.length === 0) return;

  subheader(`Failures (${failures.length})`);

  for (const failure of failures) {
    console.log();
    console.log(`  ${symbols.fail} ${c.red(failure.testCaseId)} [${failure.phase}]`);
    console.log(`    ${c.dim("Error:")} ${failure.error}`);
    if (failure.rerunCommand) {
      console.log(`    ${c.dim("Rerun:")} ${c.cyan(failure.rerunCommand)}`);
    }
  }
}

// ============================================================================
// JSON Output
// ============================================================================

interface JsonOutput {
  success: boolean;
  data?: unknown;
  errors?: string[];
  logs?: Array<{ level: LogLevel; message: string; timestamp: string }>;
  failures?: FailureRecord[];
}

export function outputJson(data: unknown, success = true): void {
  const output: JsonOutput = {
    success,
    data,
  };

  if (failures.length > 0) {
    output.failures = failures;
    output.success = false;
  }

  const errors = logBuffer.filter((l) => l.level === "error");
  if (errors.length > 0) {
    output.errors = errors.map((e) => e.message);
  }

  if (isVerboseMode()) {
    output.logs = logBuffer.map((l) => ({
      level: l.level,
      message: l.message,
      timestamp: l.timestamp.toISOString(),
    }));
  }

  console.log(JSON.stringify(output, null, 2));
}

// ============================================================================
// Formatting Helpers
// ============================================================================

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(ms / 3600000);
  const mins = Math.round((ms % 3600000) / 60000);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatPercent(value: number, decimals = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatDelta(value: number, higherIsBetter = true, decimals = 1): string {
  const sign = value > 0 ? "+" : "";
  const formatted = `${sign}${value.toFixed(decimals)}`;

  if (!colorsEnabled()) return formatted;

  const isGood = higherIsBetter ? value > 0 : value < 0;
  const isBad = higherIsBetter ? value < 0 : value > 0;

  if (isGood) return c.green(formatted);
  if (isBad) return c.red(formatted);
  return c.gray(formatted);
}

export function formatScoreDelta(baseline: number, candidate: number, decimals = 2): string {
  const delta = candidate - baseline;
  const pctChange = baseline !== 0 ? ((candidate - baseline) / baseline) * 100 : 0;

  const sign = delta > 0 ? "+" : "";
  const deltaStr = `${sign}${delta.toFixed(decimals)}`;
  const pctStr = `(${sign}${pctChange.toFixed(1)}%)`;

  if (!colorsEnabled()) return `${deltaStr} ${pctStr}`;

  if (delta > 0) return `${c.green(deltaStr)} ${c.dim(c.green(pctStr))}`;
  if (delta < 0) return `${c.red(deltaStr)} ${c.dim(c.red(pctStr))}`;
  return `${c.gray(deltaStr)} ${c.dim(pctStr)}`;
}

export function formatNumber(num: number, decimals = 2): string {
  if (Number.isInteger(num)) return num.toString();
  return num.toFixed(decimals);
}

export function formatRate(count: number, durationMs: number, unit = "min"): string {
  if (durationMs === 0) return "0/min";

  const multiplier = unit === "min" ? 60000 : unit === "sec" ? 1000 : 3600000;
  const rate = (count / durationMs) * multiplier;

  return `${formatNumber(rate, 1)}/${unit}`;
}
