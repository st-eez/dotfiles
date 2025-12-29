/**
 * Shared types for A/B Testing V3 metadata capture.
 * Centralized here to avoid circular dependencies between exec.ts and evaluator.ts.
 */

export interface TimingData {
  startMs: number;
  endMs: number;
  durationMs: number;
}

export interface RetryData {
  attempts: number;
  totalRetryDelayMs: number;
  failedAttempts: string[];
}

export interface TokenData {
  input: number;
  output: number;
  total: number;
  cached: number;
  thoughts: number;
  latencyMs: number;
}

export interface OptimizationMetadata {
  timing: TimingData;
  retry: RetryData;
  tokens: TokenData | null;
  promptCharCount: number;
  outputCharCount: number;
}
