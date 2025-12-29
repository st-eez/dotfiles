/**
 * CLI Table - Table rendering utilities using cli-table3.
 * Provides consistent table formatting with Unicode/ASCII support.
 */

import Table from "cli-table3";
import { c, getOutputOptions, isJsonMode, isQuietMode, getTerminalWidth, truncate } from "./cli-output";

// ============================================================================
// Border Characters
// ============================================================================

interface BorderChars {
  top: string;
  "top-mid": string;
  "top-left": string;
  "top-right": string;
  bottom: string;
  "bottom-mid": string;
  "bottom-left": string;
  "bottom-right": string;
  left: string;
  "left-mid": string;
  mid: string;
  "mid-mid": string;
  right: string;
  "right-mid": string;
  middle: string;
}

function getUnicodeBorders(): BorderChars {
  return {
    top: "─",
    "top-mid": "┬",
    "top-left": "┌",
    "top-right": "┐",
    bottom: "─",
    "bottom-mid": "┴",
    "bottom-left": "└",
    "bottom-right": "┘",
    left: "│",
    "left-mid": "├",
    mid: "─",
    "mid-mid": "┼",
    right: "│",
    "right-mid": "┤",
    middle: "│",
  };
}

function getAsciiBorders(): BorderChars {
  return {
    top: "-",
    "top-mid": "+",
    "top-left": "+",
    "top-right": "+",
    bottom: "-",
    "bottom-mid": "+",
    "bottom-left": "+",
    "bottom-right": "+",
    left: "|",
    "left-mid": "+",
    mid: "-",
    "mid-mid": "+",
    right: "|",
    "right-mid": "+",
    middle: "|",
  };
}

function getMinimalBorders(): BorderChars {
  const opts = getOutputOptions();
  const h = opts.ascii ? "-" : "─";
  const v = opts.ascii ? "|" : "│";
  return {
    top: "",
    "top-mid": "",
    "top-left": "",
    "top-right": "",
    bottom: "",
    "bottom-mid": "",
    "bottom-left": "",
    "bottom-right": "",
    left: v,
    "left-mid": v,
    mid: h,
    "mid-mid": opts.ascii ? "+" : "┼",
    right: v,
    "right-mid": v,
    middle: v,
  };
}

function getBorderChars(minimal = false): BorderChars {
  if (minimal) return getMinimalBorders();
  const opts = getOutputOptions();
  return opts.ascii ? getAsciiBorders() : getUnicodeBorders();
}

// ============================================================================
// Table Builder
// ============================================================================

export interface CreateTableOptions {
  headers: string[];
  colWidths?: number[];
  colAligns?: Array<"left" | "center" | "right">;
  wordWrap?: boolean;
  minimal?: boolean;
  colorHeader?: boolean;
}

export function createTable(options: CreateTableOptions): Table.Table {
  const { headers, colWidths, colAligns, wordWrap = true, minimal = false, colorHeader = true } = options;

  const styledHeaders = colorHeader ? headers.map((h) => c.bold(c.cyan(h))) : headers;

  const tableConfig: Table.TableConstructorOptions = {
    head: styledHeaders,
    chars: getBorderChars(minimal),
    wordWrap,
    style: {
      head: [],
      border: [],
    },
  };

  if (colWidths) tableConfig.colWidths = colWidths;
  if (colAligns) tableConfig.colAligns = colAligns;

  return new Table(tableConfig);
}

export function printTable(table: Table.Table): void {
  if (isJsonMode() || isQuietMode()) return;
  console.log(table.toString());
}

export function tableToString(table: Table.Table): string {
  return table.toString();
}

// ============================================================================
// Pre-built Table Types
// ============================================================================

export function createResultsTable(): Table.Table {
  return createTable({
    headers: ["Test Case", "Status", "Score", "Duration"],
    colAligns: ["left", "center", "right", "right"],
  });
}

export function createComparisonTable(): Table.Table {
  return createTable({
    headers: ["Metric", "Baseline", "Candidate", "Delta"],
    colAligns: ["left", "right", "right", "right"],
  });
}

export function createStatsTable(): Table.Table {
  return createTable({
    headers: ["Statistic", "Value"],
    colAligns: ["left", "right"],
    minimal: true,
  });
}

export function createCacheTable(): Table.Table {
  return createTable({
    headers: ["Cache", "Hits", "Misses", "Hit Rate"],
    colAligns: ["left", "right", "right", "right"],
  });
}

export function createBenchmarkTable(): Table.Table {
  return createTable({
    headers: ["Test", "Avg (ms)", "Min (ms)", "Max (ms)", "Runs"],
    colAligns: ["left", "right", "right", "right", "right"],
  });
}

export function createSummaryTable(): Table.Table {
  return createTable({
    headers: ["Category", "Passed", "Failed", "Skipped", "Total"],
    colAligns: ["left", "right", "right", "right", "right"],
  });
}

// ============================================================================
// Row Helpers
// ============================================================================

export function addRow(table: Table.Table, cells: Array<string | number>): void {
  table.push(cells.map((cell) => String(cell)));
}

export function addStatusRow(
  table: Table.Table,
  id: string,
  passed: boolean,
  score: number | string,
  duration: string,
): void {
  const statusIcon = passed ? c.green("PASS") : c.red("FAIL");
  const scoreStr = typeof score === "number" ? score.toFixed(2) : score;
  table.push([id, statusIcon, scoreStr, duration]);
}

export function addComparisonRow(
  table: Table.Table,
  metric: string,
  baseline: number,
  candidate: number,
  options?: { decimals?: number; higherIsBetter?: boolean },
): void {
  const { decimals = 2, higherIsBetter = true } = options ?? {};

  const delta = candidate - baseline;
  const deltaStr = (delta > 0 ? "+" : "") + delta.toFixed(decimals);

  let coloredDelta: string;
  if (delta === 0) {
    coloredDelta = c.gray(deltaStr);
  } else if ((higherIsBetter && delta > 0) || (!higherIsBetter && delta < 0)) {
    coloredDelta = c.green(deltaStr);
  } else {
    coloredDelta = c.red(deltaStr);
  }

  table.push([metric, baseline.toFixed(decimals), candidate.toFixed(decimals), coloredDelta]);
}

export function addKeyValueRow(table: Table.Table, key: string, value: string | number): void {
  table.push([c.dim(key), String(value)]);
}

// ============================================================================
// Responsive Tables
// ============================================================================

export function createResponsiveTable(options: CreateTableOptions): Table.Table {
  const termWidth = getTerminalWidth();
  const numCols = options.headers.length;

  if (!options.colWidths) {
    const padding = 4;
    const borders = numCols + 1;
    const available = termWidth - borders - padding;
    const perCol = Math.floor(available / numCols);

    const colWidths = options.headers.map((_, i) => {
      if (i === 0) return Math.min(perCol + 10, 40);
      return Math.max(perCol - 2, 10);
    });

    return createTable({ ...options, colWidths });
  }

  return createTable(options);
}

// ============================================================================
// Truncation Helpers
// ============================================================================

export function truncateCell(value: string, maxWidth: number): string {
  return truncate(value, maxWidth);
}

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(2);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

// ============================================================================
// Quick Print Helpers
// ============================================================================

export function printKeyValueTable(pairs: Array<[string, string | number]>, title?: string): void {
  if (isJsonMode() || isQuietMode()) return;

  if (title) {
    console.log(c.bold(title));
  }

  const table = createStatsTable();
  for (const [key, value] of pairs) {
    addKeyValueRow(table, key, value);
  }
  printTable(table);
}

export function printSimpleTable(headers: string[], rows: Array<Array<string | number>>): void {
  if (isJsonMode() || isQuietMode()) return;

  const table = createTable({ headers });
  for (const row of rows) {
    addRow(table, row);
  }
  printTable(table);
}
