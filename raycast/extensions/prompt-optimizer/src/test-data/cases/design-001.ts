import { TestCase } from "../types";

export const testCase: TestCase = {
  id: "design-001",
  category: "system-design",
  description: "CI/CD workflow audit (migrated TC-001)",
  userRequest: "Audit this GitHub Actions workflow for security vulnerabilities and performance bottlenecks.",
  additionalContext: `name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: npm install
      run: npm install
    - name: run tests
      run: npm test`,
  mode: "quick",
};
