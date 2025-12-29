import { TestCase } from "../types";

export const testCase: TestCase = {
  id: "calibration-perfect",
  category: "calibration",
  description: "Well-structured prompt for judge calibration - should score high",
  userRequest:
    "Write a Python function that calculates the factorial of a number. Include input validation, handle edge cases (negative numbers, zero), and add comprehensive docstrings.",
  additionalContext: `Requirements:
- Use recursive or iterative approach (document which and why)
- Raise ValueError for negative inputs
- Return 1 for factorial(0)
- Include type hints
- Add unit test examples in docstring`,
  mode: "quick",
  expectedScore: { min: 4.0, max: 5.0 },
};
