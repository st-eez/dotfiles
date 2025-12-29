import { TestCase } from "../types";

export const testCase: TestCase = {
  id: "calibration-minimal",
  category: "calibration",
  description: "Vague request for baseline scoring - should score adequate (3.0-3.5)",
  userRequest: "Make a todo app",
  expectedScore: { min: 2.5, max: 4.0 },
};
