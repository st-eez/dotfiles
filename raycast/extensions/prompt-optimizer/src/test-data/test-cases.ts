import type { TestCase } from "./types";
export type { TestCase } from "./types";
export { generateLongContext } from "./utils";

import { testCase as code001 } from "./cases/code-001";
import { testCase as code002 } from "./cases/code-002";
import { testCase as code003 } from "./cases/code-003";
import { testCase as code004 } from "./cases/code-004";
import { testCase as code005 } from "./cases/code-005";
import { testCase as write001 } from "./cases/write-001";
import { testCase as write002 } from "./cases/write-002";
import { testCase as write003 } from "./cases/write-003";
import { testCase as write004 } from "./cases/write-004";
import { testCase as design001 } from "./cases/design-001";
import { testCase as design002 } from "./cases/design-002";
import { testCase as design003 } from "./cases/design-003";
import { testCase as data001 } from "./cases/data-001";
import { testCase as data002 } from "./cases/data-002";
import { testCase as data003 } from "./cases/data-003";
import { testCase as complex001 } from "./cases/complex-001";
import { testCase as complex002 } from "./cases/complex-002";
import { testCase as complex003 } from "./cases/complex-003";
import { testCase as complex004 } from "./cases/complex-004";
import { testCase as edge001 } from "./cases/edge-001";
import { testCase as edge002 } from "./cases/edge-002";
import { testCase as ops001 } from "./cases/ops-001";
import { testCase as ops002 } from "./cases/ops-002";
import { testCase as ops003 } from "./cases/ops-003";
import { testCase as calibrationPerfect } from "./cases/calibration-perfect";
import { testCase as calibrationMinimal } from "./cases/calibration-minimal";
import { testCase as calibrationBroken } from "./cases/calibration-broken";

export const TEST_CASES: TestCase[] = [
  code001,
  code002,
  code003,
  code004,
  code005,
  write001,
  write002,
  write003,
  write004,
  design001,
  design002,
  design003,
  data001,
  data002,
  data003,
  complex001,
  complex002,
  complex003,
  complex004,
  edge001,
  edge002,
  ops001,
  ops002,
  ops003,
  calibrationPerfect,
  calibrationMinimal,
  calibrationBroken,
];

export function getTestCasesByCategory(category: string): TestCase[] {
  return TEST_CASES.filter((tc) => tc.category === category);
}

export function getTestCaseById(id: string): TestCase | undefined {
  return TEST_CASES.find((tc) => tc.id === id);
}

export const CALIBRATION_TEST_CASES = TEST_CASES.filter((tc) => tc.category === "calibration");

export const AB_TEST_CASES = TEST_CASES.filter((tc) => !tc.excludeFromAB);
