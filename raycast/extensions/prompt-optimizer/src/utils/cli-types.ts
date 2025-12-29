/**
 * CLI Types - Shared type definitions for CLI output system
 */

// --- Environment Detection ---

export interface CliEnvironment {
  /** Whether stdout is a TTY (terminal) */
  isTTY: boolean;
  /** Whether running in CI environment */
  isCI: boolean;
  /** Whether colors are disabled (NO_COLOR env) */
  noColor: boolean;
  /** Whether to force colors (FORCE_COLOR env) */
  forceColor: boolean;
  /** Terminal width in columns */
  columns: number;
  /** Whether Unicode is supported */
  supportsUnicode: boolean;
}

// --- Output Modes ---

export type OutputMode = "normal" | "quiet" | "verbose" | "json";

export interface OutputOptions {
  mode: OutputMode;
  noColor: boolean;
  ascii: boolean;
}

// --- Symbols ---

export interface SymbolSet {
  ok: string;
  fail: string;
  warn: string;
  info: string;
  arrow: string;
  running: string;
  pending: string;
  skip: string;
  bullet: string;
  dash: string;
  ellipsis: string;
}

// --- Log Levels ---

export type LogLevel = "debug" | "info" | "success" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

// --- Progress ---

export interface ProgressState {
  current: number;
  total: number;
  phase: string;
  startTime: number;
  cacheHits: number;
  cacheMisses: number;
  retries: number;
  errors: number;
  lastUpdate: number;
}

export interface ProgressOptions {
  /** Minimum ms between updates (default: 100) */
  throttleMs?: number;
  /** Show ETA (default: true) */
  showEta?: boolean;
  /** Show throughput (default: true) */
  showThroughput?: boolean;
  /** Show cache stats (default: true) */
  showCacheStats?: boolean;
  /** Width of progress bar (default: 20) */
  barWidth?: number;
}

// --- Tables ---

export interface TableOptions {
  /** Column headers */
  headers: string[];
  /** Column alignments */
  align?: ("left" | "center" | "right")[];
  /** Column max widths (0 = no limit) */
  maxWidths?: number[];
  /** Whether to show borders */
  borders?: boolean;
  /** Whether to colorize header */
  colorHeader?: boolean;
}

// --- Failures ---

export interface FailureRecord {
  testCaseId: string;
  phase: "optimize" | "judge" | "validate";
  error: string;
  timestamp: Date;
  rerunCommand?: string;
}

// --- CLI Arguments (common across scripts) ---

export interface CommonCliArgs {
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  noColor?: boolean;
  ascii?: boolean;
}
