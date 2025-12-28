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
function average(arr: number[]): number {
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
    };
  }

  const baselineAvg = average(baseline);
  const candidateAvg = average(candidate);
  const improvement = candidateAvg - baselineAvg;

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
  };
}

/**
 * Standard normal cumulative distribution function.
 * Approximation using error function.
 */
function normalCDF(x: number): number {
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
    return {
      decision: "inconclusive",
      stats: {
        baselineAvg: average(baselineScores),
        candidateAvg: average(candidateScores),
        improvement: average(candidateScores) - average(baselineScores),
        pValue: 1,
        significant: false,
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
