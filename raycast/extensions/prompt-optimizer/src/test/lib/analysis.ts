/**
 * Output Analysis for A/B Testing
 *
 * Detects patterns in synthesized prompts that indicate quality issues.
 */

// --- Committee Detection ---

/**
 * Patterns that indicate the LLM created a "committee" or "hybrid" role
 * instead of synthesizing a focused persona.
 */
const COMMITTEE_PATTERNS = [
  /hybrid.*expert/i,
  /task force/i,
  /team of.*specialists/i,
  /consisting of.*(?:and|,).*(?:and|,)/i,
  /multiple experts/i,
  /panel of/i,
  /collaborative team/i,
  /cross-functional/i,
  /multi-disciplinary/i,
];

export interface AnalysisResult {
  hasCommitteeRole: boolean;
  matchedPattern?: string;
}

/**
 * Detect if a synthesis contains a committee-style role.
 */
export function detectCommitteeRole(synthesis: string): AnalysisResult {
  for (const pattern of COMMITTEE_PATTERNS) {
    const match = synthesis.match(pattern);
    if (match) {
      return { hasCommitteeRole: true, matchedPattern: match[0] };
    }
  }
  return { hasCommitteeRole: false };
}

export interface BatchAnalysisResult {
  total: number;
  committeeCount: number;
  flagged: string[];
}

/**
 * Analyze a batch of results for committee-style roles.
 */
export function analyzeResults(results: Array<{ testCaseId: string; synthesis: string }>): BatchAnalysisResult {
  const flagged: string[] = [];
  for (const r of results) {
    if (detectCommitteeRole(r.synthesis).hasCommitteeRole) {
      flagged.push(r.testCaseId);
    }
  }
  return { total: results.length, committeeCount: flagged.length, flagged };
}
