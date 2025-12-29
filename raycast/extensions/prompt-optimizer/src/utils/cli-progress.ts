/**
 * CLI Progress - Progress bar and spinner rendering for CLI test scripts.
 * Provides throttled progress updates with ETA, throughput, and cache stats.
 */

import {
  env,
  c,
  formatDuration,
  formatPercent,
  getOutputOptions,
  isJsonMode,
  isQuietMode,
  isSimpleMode,
} from "./cli-output";
import type { ProgressState, ProgressOptions } from "./cli-types";

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: Required<ProgressOptions> = {
  throttleMs: 100,
  showEta: true,
  showThroughput: true,
  showCacheStats: true,
  barWidth: 20,
};

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const ASCII_SPINNER_FRAMES = ["|", "/", "-", "\\"];

// ============================================================================
// Progress Bar Renderer
// ============================================================================

function getBarChars(): { filled: string; empty: string; left: string; right: string } {
  const opts = getOutputOptions();
  if (opts.ascii) {
    return { filled: "=", empty: "-", left: "[", right: "]" };
  }
  return { filled: "█", empty: "░", left: "", right: "" };
}

export function renderBar(current: number, total: number, width: number = DEFAULT_OPTIONS.barWidth): string {
  if (total <= 0) return "";

  const ratio = Math.min(current / total, 1);
  const filledWidth = Math.round(ratio * width);
  const emptyWidth = width - filledWidth;

  const chars = getBarChars();
  const bar = chars.filled.repeat(filledWidth) + chars.empty.repeat(emptyWidth);

  return `${chars.left}${c.cyan(bar)}${chars.right}`;
}

export function calculateEta(current: number, total: number, elapsedMs: number): number | null {
  if (current <= 0 || elapsedMs <= 0) return null;

  const rate = current / elapsedMs;
  const remaining = total - current;

  if (remaining <= 0) return 0;

  return remaining / rate;
}

export function calculateThroughput(count: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return (count / elapsedMs) * 60000;
}

// ============================================================================
// ProgressManager Class
// ============================================================================

export class ProgressManager {
  private state: ProgressState;
  private options: Required<ProgressOptions>;
  private lastRenderTime: number = 0;
  private isRunning: boolean = false;
  private lastLineLength: number = 0;

  constructor(options: { total: number; phase?: string } & Partial<ProgressOptions>) {
    this.state = {
      current: 0,
      total: options.total,
      phase: options.phase ?? "Processing",
      startTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      retries: 0,
      errors: 0,
      lastUpdate: 0,
    };

    this.options = {
      ...DEFAULT_OPTIONS,
      throttleMs: options.throttleMs ?? DEFAULT_OPTIONS.throttleMs,
      showEta: options.showEta ?? DEFAULT_OPTIONS.showEta,
      showThroughput: options.showThroughput ?? DEFAULT_OPTIONS.showThroughput,
      showCacheStats: options.showCacheStats ?? DEFAULT_OPTIONS.showCacheStats,
      barWidth: options.barWidth ?? DEFAULT_OPTIONS.barWidth,
    };
  }

  start(): void {
    if (!this.shouldRender()) return;

    this.state.startTime = Date.now();
    this.state.lastUpdate = this.state.startTime;
    this.isRunning = true;
    this.render();
  }

  increment(options?: { cacheHit?: boolean; retry?: boolean; error?: boolean }): void {
    this.state.current++;
    this.state.lastUpdate = Date.now();

    if (options?.cacheHit) {
      this.state.cacheHits++;
    } else {
      this.state.cacheMisses++;
    }

    if (options?.retry) {
      this.state.retries++;
    }

    if (options?.error) {
      this.state.errors++;
    }

    this.renderThrottled();
  }

  setPhase(phase: string): void {
    this.state.phase = phase;
    this.renderThrottled();
  }

  setCurrent(current: number): void {
    this.state.current = current;
    this.state.lastUpdate = Date.now();
    this.renderThrottled();
  }

  finish(message?: string): void {
    if (!this.shouldRender()) return;

    this.clearLine();
    this.isRunning = false;

    if (message) {
      console.log(message);
    }
  }

  getState(): ProgressState {
    return { ...this.state };
  }

  private shouldRender(): boolean {
    if (isJsonMode() || isQuietMode()) return false;
    if (isSimpleMode()) return false;
    if (!env.isTTY) return false;
    return true;
  }

  private renderThrottled(): void {
    if (!this.shouldRender() || !this.isRunning) return;

    const now = Date.now();
    if (now - this.lastRenderTime < this.options.throttleMs) return;

    this.lastRenderTime = now;
    this.render();
  }

  private render(): void {
    const { current, total, phase, startTime, cacheHits, cacheMisses } = this.state;
    const elapsed = Date.now() - startTime;

    const parts: string[] = [];

    parts.push(`${c.bold(phase)}...`);
    parts.push(renderBar(current, total, this.options.barWidth));
    parts.push(`${current}/${total}`);
    parts.push(`(${formatPercent(current / total)})`);

    if (this.options.showEta && current > 0) {
      const eta = calculateEta(current, total, elapsed);
      if (eta !== null && eta > 0) {
        parts.push(`${c.dim("|")} ETA: ${formatDuration(eta)}`);
      }
    }

    if (this.options.showThroughput && current > 0) {
      const throughput = calculateThroughput(current, elapsed);
      parts.push(`${c.dim("|")} ${throughput.toFixed(1)}/min`);
    }

    if (this.options.showCacheStats) {
      const totalOps = cacheHits + cacheMisses;
      if (totalOps > 0) {
        const cacheRate = cacheHits / totalOps;
        parts.push(`${c.dim("|")} Cache: ${formatPercent(cacheRate)}`);
      }
    }

    const line = parts.join(" ");
    this.writeLine(line);
  }

  private writeLine(line: string): void {
    this.clearLine();
    process.stderr.write(line);
    this.lastLineLength = line.length;
  }

  private clearLine(): void {
    if (this.lastLineLength > 0) {
      process.stderr.write("\r" + " ".repeat(this.lastLineLength) + "\r");
    }
  }
}

// ============================================================================
// Simple Progress Functions
// ============================================================================

let activeProgress: ProgressManager | null = null;

export function startProgress(total: number, phase?: string, options?: Partial<ProgressOptions>): void {
  if (activeProgress) {
    activeProgress.finish();
  }

  activeProgress = new ProgressManager({ total, phase, ...options });
  activeProgress.start();
}

export function incrementProgress(options?: { cacheHit?: boolean; retry?: boolean; error?: boolean }): void {
  activeProgress?.increment(options);
}

export function setProgressPhase(phase: string): void {
  activeProgress?.setPhase(phase);
}

export function setProgressCurrent(current: number): void {
  activeProgress?.setCurrent(current);
}

export function finishProgress(message?: string): void {
  activeProgress?.finish(message);
  activeProgress = null;
}

export function getProgressState(): ProgressState | null {
  return activeProgress?.getState() ?? null;
}

// ============================================================================
// Spinner Class
// ============================================================================

export class Spinner {
  private message: string;
  private frameIndex: number = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastLineLength: number = 0;

  constructor(message: string) {
    this.message = message;
  }

  start(): void {
    if (!this.shouldRender()) return;

    this.render();
    this.intervalId = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.getFrames().length;
      this.render();
    }, 80);
  }

  update(message: string): void {
    this.message = message;
    if (this.shouldRender() && this.intervalId) {
      this.render();
    }
  }

  stop(finalMessage?: string): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.shouldRender()) {
      this.clearLine();
      if (finalMessage) {
        console.log(finalMessage);
      }
    }
  }

  private shouldRender(): boolean {
    if (isJsonMode() || isQuietMode()) return false;
    if (isSimpleMode()) return false;
    if (!env.isTTY) return false;
    return true;
  }

  private getFrames(): string[] {
    const opts = getOutputOptions();
    return opts.ascii ? ASCII_SPINNER_FRAMES : SPINNER_FRAMES;
  }

  private render(): void {
    const frame = c.cyan(this.getFrames()[this.frameIndex]);
    const line = `${frame} ${this.message}`;
    this.writeLine(line);
  }

  private writeLine(line: string): void {
    this.clearLine();
    process.stderr.write(line);
    this.lastLineLength = line.length;
  }

  private clearLine(): void {
    if (this.lastLineLength > 0) {
      process.stderr.write("\r" + " ".repeat(this.lastLineLength) + "\r");
    }
  }
}

// ============================================================================
// Spinner Helper Functions
// ============================================================================

let activeSpinner: Spinner | null = null;

export function startSpinner(message: string): void {
  if (activeSpinner) {
    activeSpinner.stop();
  }

  activeSpinner = new Spinner(message);
  activeSpinner.start();
}

export function updateSpinner(message: string): void {
  activeSpinner?.update(message);
}

export function stopSpinner(finalMessage?: string): void {
  activeSpinner?.stop(finalMessage);
  activeSpinner = null;
}
