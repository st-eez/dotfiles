import { TestCase } from "../types";
import { generateLongContext } from "../utils";

export const testCase: TestCase = {
  id: "edge-002",
  category: "edge",
  description: "Long prompt stress test",
  userRequest: "Analyze these service logs and identify patterns that might indicate a memory leak.",
  additionalContext: generateLongContext(8000),
};
