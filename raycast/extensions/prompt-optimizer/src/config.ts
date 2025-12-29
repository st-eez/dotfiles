/**
 * Centralized configuration for Prompt Optimizer.
 *
 * All hardcoded values that affect behavior should be defined here.
 * This enables easier tuning, A/B testing, and documentation of defaults.
 */

export interface PromptOptimizerConfig {
  // Timeouts (ms)
  timeoutStandardMs: number;
  timeoutOrchestratedMultiplier: number;
  timeoutEvaluatorMs: number;

  // Concurrency
  defaultConcurrency: number;
  maxConcurrency: number;

  // Statistical thresholds
  significanceThreshold: number;
  minImprovementThreshold: number;

  // Scoring weights (must sum to 1.0)
  weights: {
    clarity: number;
    completeness: number;
    actionability: number;
  };

  // Smart mode
  personaCountMin: number;
  personaCountMax: number;

  // UI behavior
  templateVariableDebounceMs: number;
}

/**
 * Default configuration values.
 *
 * Rationale for each value:
 * - timeoutStandardMs: 180s allows for slow API responses without premature timeout
 * - timeoutOrchestratedMultiplier: 1.5x accounts for multi-step orchestration
 * - timeoutEvaluatorMs: 60s is sufficient for judge evaluations
 * - defaultConcurrency: 3 balances throughput vs API rate limits
 * - maxConcurrency: 8 prevents overwhelming the API
 * - significanceThreshold: 0.05 is standard p-value threshold
 * - minImprovementThreshold: 0.5 ensures meaningful quality deltas
 * - weights: 40/30/30 prioritizes clarity slightly over completeness/actionability
 * - personaCount: 2-3 balances perspective diversity vs latency
 * - templateVariableDebounceMs: 300ms reduces keystroke processing overhead
 */
export const DEFAULT_CONFIG: PromptOptimizerConfig = {
  // Timeouts
  timeoutStandardMs: 180_000,
  timeoutOrchestratedMultiplier: 1.5,
  timeoutEvaluatorMs: 60_000,

  // Concurrency
  defaultConcurrency: 3,
  maxConcurrency: 8,

  // Statistical thresholds
  significanceThreshold: 0.05,
  minImprovementThreshold: 0.5,

  // Scoring weights
  weights: {
    clarity: 0.4,
    completeness: 0.3,
    actionability: 0.3,
  },

  // Smart mode
  personaCountMin: 2,
  personaCountMax: 3,

  // UI behavior
  templateVariableDebounceMs: 300,
};

/**
 * Active configuration instance.
 * Currently uses defaults; can be extended to load from environment or file.
 */
export const config: PromptOptimizerConfig = { ...DEFAULT_CONFIG };

/**
 * Helper to get timeout for a given mode.
 */
export function getTimeoutMs(isOrchestrated: boolean): number {
  return isOrchestrated ? config.timeoutStandardMs * config.timeoutOrchestratedMultiplier : config.timeoutStandardMs;
}
