import { TestCase } from "../types";

export const testCase: TestCase = {
  id: "complex-002",
  category: "complex",
  description: "Output format with specific structure requirements",
  userRequest:
    "Generate a weekly status report for my team's sprint. Include blockers, completed items, and next week's priorities. Format it for both Slack posting and email.",
  additionalContext: `Sprint 47 data:
Completed: AUTH-123 (JWT migration phase 1), AUTH-124 (token refresh), FE-89 (login redesign)
In Progress: AUTH-125 (session cleanup cron), FE-90 (2FA UI) - blocked by design review
Blocked: INFRA-45 (Redis cluster) - waiting on AWS quota increase
Velocity: 21 points completed, 8 carried over

Team: Alice (backend), Bob (frontend), Carol (QA - out sick Thu-Fri)`,
  mode: "quick",
};
