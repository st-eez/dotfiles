export interface TestCase {
  id: string;
  category: string;
  description: string;
  userRequest: string;
  additionalContext?: string;
  persona?: string;
  mode: "quick" | "detailed";
}

import { QUICK_TEST_CASES } from "./test-cases-quick";
import { DETAILED_TEST_CASES, generateLongContext } from "./test-cases-detailed";

export { QUICK_TEST_CASES, DETAILED_TEST_CASES, generateLongContext };

export const TEST_CASES: TestCase[] = [...QUICK_TEST_CASES, ...DETAILED_TEST_CASES];

export function getTestCasesByCategory(category: string): TestCase[] {
  return TEST_CASES.filter((tc) => tc.category === category);
}

export function getTestCasesByMode(mode: "quick" | "detailed"): TestCase[] {
  return TEST_CASES.filter((tc) => tc.mode === mode);
}

export function getTestCaseById(id: string): TestCase | undefined {
  return TEST_CASES.find((tc) => tc.id === id);
}
