/**
 * Statistical Analysis for A/B Testing
 *
 * Implements Wilcoxon signed-rank test for paired samples.
 */

// --- Types ---

export interface StatResult {
  baselineAvg: number;
  candidateAvg: number;
  improvement: number;
  pValue: number;
  significant: boolean;
  effectSize: number;
  effectSizeLabel: "negligible" | "small" | "medium" | "large";
}

export type Decision = "ship_candidate" | "keep_baseline" | "inconclusive";

export interface DecisionResult {
  decision: Decision;
  stats: StatResult;
}

// --- Constants ---

const SIGNIFICANCE_THRESHOLD = 0.05;

/**
 * Minimum improvement threshold for shipping candidate.
 *
 * Rationale: On a 1-5 scale, 0.5 points = 10% relative improvement.
 * Filters out statistically significant but practically insignificant gains.
 */
const MIN_IMPROVEMENT_THRESHOLD = 0.5;

// --- Helper Functions ---

/**
 * Calculate the average of an array of numbers.
 */
export function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/**
 * Calculate the sign of a number: 1, -1, or 0.
 */
function sign(x: number): number {
  if (x > 0) return 1;
  if (x < 0) return -1;
  return 0;
}

export function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const avg = average(arr);
  const squareDiffs = arr.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / (arr.length - 1));
}

export function confidenceInterval(arr: number[]): { lower: number; upper: number } {
  if (arr.length < 2) return { lower: 0, upper: 0 };
  const avg = average(arr);
  const se = stdDev(arr) / Math.sqrt(arr.length);
  const margin = 1.96 * se;
  return { lower: avg - margin, upper: avg + margin };
}

// --- Effect Size ---

/**
 * Calculate Cohen's d effect size for standardized difference measurement.
 *
 * Effect size interpretation:
 * - |d| < 0.2: negligible effect
 * - |d| < 0.5: small effect
 * - |d| < 0.8: medium effect
 * - |d| >= 0.8: large effect
 *
 * @param baseline - Array of baseline scores
 * @param candidate - Array of candidate scores
 * @returns Cohen's d value (positive = candidate better, negative = baseline better)
 */
export function cohensD(baseline: number[], candidate: number[]): number {
  if (baseline.length === 0 || candidate.length === 0) return 0;

  const baselineAvg = average(baseline);
  const candidateAvg = average(candidate);
  const meanDiff = candidateAvg - baselineAvg;

  // Pooled standard deviation
  const baselineVar = Math.pow(stdDev(baseline), 2);
  const candidateVar = Math.pow(stdDev(candidate), 2);

  const pooledStd = Math.sqrt(
    ((baseline.length - 1) * baselineVar + (candidate.length - 1) * candidateVar) /
      (baseline.length + candidate.length - 2),
  );

  return pooledStd === 0 ? 0 : meanDiff / pooledStd;
}

/**
 * Convert Cohen's d value to human-readable label.
 */
export function effectSizeLabel(d: number): "negligible" | "small" | "medium" | "large" {
  const absD = Math.abs(d);
  if (absD < 0.2) return "negligible";
  if (absD < 0.5) return "small";
  if (absD < 0.8) return "medium";
  return "large";
}

// --- Bootstrap Confidence Interval ---

/**
 * Bootstrap confidence interval for score difference.
 * Uses resampling with replacement to estimate uncertainty.
 *
 * @param baseline - Array of baseline scores
 * @param candidate - Array of candidate scores (same length as baseline)
 * @param confidence - Confidence level (default 0.95 for 95% CI)
 * @param nBootstrap - Number of bootstrap samples (default 1000)
 * @returns Lower and upper bounds of the confidence interval for the difference
 */
export function bootstrapCIDifference(
  baseline: number[],
  candidate: number[],
  confidence: number = 0.95,
  nBootstrap: number = 1000,
): { lower: number; upper: number } {
  if (baseline.length === 0 || candidate.length === 0) return { lower: 0, upper: 0 };
  if (baseline.length !== candidate.length) return { lower: 0, upper: 0 };

  const n = baseline.length;
  const differences: number[] = [];

  for (let i = 0; i < nBootstrap; i++) {
    // Bootstrap sample with replacement
    const baselineSample: number[] = [];
    const candidateSample: number[] = [];

    for (let j = 0; j < n; j++) {
      const idx = Math.floor(Math.random() * n);
      baselineSample.push(baseline[idx]);
      candidateSample.push(candidate[idx]);
    }

    const diff = average(candidateSample) - average(baselineSample);
    differences.push(diff);
  }

  differences.sort((a, b) => a - b);
  const lowerIdx = Math.floor(((1 - confidence) / 2) * nBootstrap);
  const upperIdx = Math.floor(((1 + confidence) / 2) * nBootstrap);

  return {
    lower: differences[lowerIdx],
    upper: differences[upperIdx - 1], // -1 because array is 0-indexed
  };
}

export function checkSRM(
  baselineN: number,
  candidateN: number,
  expectedRatio: number = 1.0,
): { hasSRM: boolean; observedRatio: number; pValue: number } {
  const total = baselineN + candidateN;
  if (total === 0) return { hasSRM: false, observedRatio: 0, pValue: 1 };

  const expectedBaseline = total * (expectedRatio / (1 + expectedRatio));
  const expectedCandidate = total - expectedBaseline;

  const chiSq =
    Math.pow(baselineN - expectedBaseline, 2) / expectedBaseline +
    Math.pow(candidateN - expectedCandidate, 2) / expectedCandidate;

  const pValue = 2 * (1 - normalCDF(Math.sqrt(chiSq)));

  return {
    hasSRM: pValue < 0.01,
    observedRatio: candidateN > 0 ? baselineN / candidateN : 0,
    pValue,
  };
}

export interface EnhancedSummary {
  baselineAvgScore: number;
  candidateAvgScore: number;
  improvement: number;
  pValue: number;
  significant: boolean;
  decision: Decision;

  effectSize: {
    cohensD: number;
    label: "negligible" | "small" | "medium" | "large";
    bootstrapCI: { lower: number; upper: number };
  };

  timing: {
    baselineMedianMs: number;
    candidateMedianMs: number;
    latencyReductionPct: number;
    baselineCI: { lower: number; upper: number };
    candidateCI: { lower: number; upper: number };
  };
  tokens: {
    baselineMedian: number;
    candidateMedian: number;
    tokenReductionPct: number;
  };

  srmCheck: { hasSRM: boolean; observedRatio: number; pValue: number };
}

export function buildEnhancedSummary(
  results: Array<{
    baseline: {
      optimization: { timing: { durationMs: number }; tokens: { input: number } | null };
      totalScore: number;
    };
    candidate: {
      optimization: { timing: { durationMs: number }; tokens: { input: number } | null };
      totalScore: number;
    };
  }>,
  baselineScores: number[],
  candidateScores: number[],
): EnhancedSummary {
  const { decision, stats } = decideWinner(baselineScores, candidateScores);

  const baselineTiming = results.map((r) => r.baseline.optimization.timing.durationMs);
  const candidateTiming = results.map((r) => r.candidate.optimization.timing.durationMs);

  const baselineTokens = results
    .map((r) => r.baseline.optimization.tokens?.input)
    .filter((t): t is number => t != null);
  const candidateTokens = results
    .map((r) => r.candidate.optimization.tokens?.input)
    .filter((t): t is number => t != null);

  const baselineMedianMs = median(baselineTiming);
  const candidateMedianMs = median(candidateTiming);
  const latencyReductionPct =
    baselineMedianMs > 0 ? ((baselineMedianMs - candidateMedianMs) / baselineMedianMs) * 100 : 0;

  const baselineTokenMedian = median(baselineTokens);
  const candidateTokenMedian = median(candidateTokens);
  const tokenReductionPct =
    baselineTokenMedian > 0 ? ((baselineTokenMedian - candidateTokenMedian) / baselineTokenMedian) * 100 : 0;

  return {
    baselineAvgScore: stats.baselineAvg,
    candidateAvgScore: stats.candidateAvg,
    improvement: stats.improvement,
    pValue: stats.pValue,
    significant: stats.significant,
    decision,
    effectSize: {
      cohensD: stats.effectSize,
      label: stats.effectSizeLabel,
      bootstrapCI: bootstrapCIDifference(baselineScores, candidateScores),
    },
    timing: {
      baselineMedianMs,
      candidateMedianMs,
      latencyReductionPct,
      baselineCI: confidenceInterval(baselineTiming),
      candidateCI: confidenceInterval(candidateTiming),
    },
    tokens: {
      baselineMedian: baselineTokenMedian,
      candidateMedian: candidateTokenMedian,
      tokenReductionPct,
    },
    srmCheck: checkSRM(results.length, results.length),
  };
}

/**
 * Count combinations of n items where sum of selected ranks <= threshold.
 * Used for exact Wilcoxon p-value calculation with small samples.
 */
function countCombinations(ranks: number[], threshold: number): number {
  const n = ranks.length;
  let count = 0;
  // Iterate through all 2^n subsets
  const total = Math.pow(2, n);
  for (let mask = 0; mask < total; mask++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      if ((mask & (1 << i)) !== 0) {
        sum += ranks[i];
      }
    }
    if (sum <= threshold) {
      count++;
    }
  }
  return count;
}

// --- Wilcoxon Signed-Rank Test ---

/**
 * Perform Wilcoxon signed-rank test for paired samples.
 *
 * @param baseline - Array of baseline scores
 * @param candidate - Array of candidate scores (same length as baseline)
 * @returns StatResult with averages, improvement, p-value, and significance
 */
export function wilcoxonSignedRank(baseline: number[], candidate: number[]): StatResult {
  if (baseline.length !== candidate.length) {
    throw new Error("Baseline and candidate arrays must have the same length");
  }

  const n = baseline.length;
  if (n === 0) {
    return {
      baselineAvg: 0,
      candidateAvg: 0,
      improvement: 0,
      pValue: 1,
      significant: false,
      effectSize: 0,
      effectSizeLabel: "negligible",
    };
  }

  const baselineAvg = average(baseline);
  const candidateAvg = average(candidate);
  const improvement = candidateAvg - baselineAvg;
  const d = cohensD(baseline, candidate);

  // Calculate differences and filter out zeros
  const differences: Array<{ diff: number; absDiff: number }> = [];
  for (let i = 0; i < n; i++) {
    const diff = candidate[i] - baseline[i];
    if (diff !== 0) {
      differences.push({ diff, absDiff: Math.abs(diff) });
    }
  }

  // If all differences are zero, no significant difference
  if (differences.length === 0) {
    return {
      baselineAvg,
      candidateAvg,
      improvement,
      pValue: 1,
      significant: false,
      effectSize: d,
      effectSizeLabel: effectSizeLabel(d),
    };
  }

  // Sort by absolute difference and assign ranks
  differences.sort((a, b) => a.absDiff - b.absDiff);

  const ranks: number[] = [];
  let i = 0;
  while (i < differences.length) {
    let j = i;
    // Find ties
    while (j < differences.length && differences[j].absDiff === differences[i].absDiff) {
      j++;
    }
    // Average rank for ties
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks.push(avgRank);
    }
    i = j;
  }

  // Calculate W+ (sum of positive ranks) and W- (sum of negative ranks)
  let wPlus = 0;
  let wMinus = 0;
  for (let idx = 0; idx < differences.length; idx++) {
    if (differences[idx].diff > 0) {
      wPlus += ranks[idx];
    } else {
      wMinus += ranks[idx];
    }
  }

  const W = Math.min(wPlus, wMinus);
  const effectiveN = differences.length;

  // Calculate p-value
  let pValue: number;

  if (effectiveN <= 20) {
    // Exact calculation for small samples
    const allRanks = ranks.slice().sort((a, b) => a - b);
    const totalCombinations = Math.pow(2, effectiveN);
    const extremeCombinations = countCombinations(allRanks, W);
    // Two-tailed test
    pValue = (2 * extremeCombinations) / totalCombinations;
    pValue = Math.min(pValue, 1);
  } else {
    // Normal approximation for larger samples
    const mean = (effectiveN * (effectiveN + 1)) / 4;
    const stdDev = Math.sqrt((effectiveN * (effectiveN + 1) * (2 * effectiveN + 1)) / 24);
    const z = (W - mean) / stdDev;
    // Two-tailed p-value using standard normal approximation
    pValue = 2 * (1 - normalCDF(Math.abs(z)));
  }

  return {
    baselineAvg,
    candidateAvg,
    improvement,
    pValue,
    significant: pValue < SIGNIFICANCE_THRESHOLD,
    effectSize: d,
    effectSizeLabel: effectSizeLabel(d),
  };
}

/**
 * Standard normal cumulative distribution function.
 * Approximation using error function.
 */
export function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const signX = sign(x);
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + signX * y);
}

// --- Decision Function ---

/**
 * Determine the winner based on statistical analysis.
 *
 * @param baselineScores - Array of baseline total scores
 * @param candidateScores - Array of candidate total scores
 * @returns Decision and statistics
 *
 * Decision logic:
 * - ship_candidate: significant improvement (p < 0.05) AND improvement >= 0.5 points
 * - keep_baseline: no significant improvement OR improvement < 0.5
 * - inconclusive: not enough data or edge cases
 */
export function decideWinner(baselineScores: number[], candidateScores: number[]): DecisionResult {
  if (baselineScores.length < 5 || candidateScores.length < 5) {
    const d = cohensD(baselineScores, candidateScores);
    return {
      decision: "inconclusive",
      stats: {
        baselineAvg: average(baselineScores),
        candidateAvg: average(candidateScores),
        improvement: average(candidateScores) - average(baselineScores),
        pValue: 1,
        significant: false,
        effectSize: d,
        effectSizeLabel: effectSizeLabel(d),
      },
    };
  }

  const stats = wilcoxonSignedRank(baselineScores, candidateScores);

  let decision: Decision;
  if (stats.significant && stats.improvement >= MIN_IMPROVEMENT_THRESHOLD) {
    decision = "ship_candidate";
  } else if (stats.significant && stats.improvement < 0) {
    // Candidate is significantly WORSE
    decision = "keep_baseline";
  } else if (!stats.significant) {
    decision = "keep_baseline";
  } else {
    // Significant but improvement below threshold
    decision = "inconclusive";
  }

  return { decision, stats };
}
