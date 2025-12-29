import { TestCase } from "../types";

export const testCase: TestCase = {
  id: "data-002",
  category: "data-analysis",
  description: "Metrics interpretation for A/B test",
  userRequest: "Interpret these A/B test results and recommend whether to ship the variant.",
  additionalContext: `Control (n=10000): Conversion 2.1%, Avg Revenue $45.20
Variant (n=10000): Conversion 2.4%, Avg Revenue $43.80
p-value for conversion: 0.048
p-value for revenue: 0.12`,
  mode: "quick",
};
