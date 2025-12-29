import { TestCase } from "../types";

export const testCase: TestCase = {
  id: "code-005",
  category: "code",
  description: "Unit test generation",
  userRequest: "Write comprehensive unit tests for this utility function.",
  additionalContext: `export function parseQueryString(qs: string): Record<string, string | string[]> {
  if (!qs || qs.length === 0) return {};
  const query = qs.startsWith('?') ? qs.slice(1) : qs;
  const pairs = query.split('&');
  const result: Record<string, string | string[]> = {};
  for (const pair of pairs) {
    const [key, value] = pair.split('=').map(decodeURIComponent);
    if (key in result) {
      const existing = result[key];
      result[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      result[key] = value;
    }
  }
  return result;
}`,
  mode: "quick",
};
