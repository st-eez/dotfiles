import { TestCase } from "../types";

export const testCase: TestCase = {
  id: "complex-001",
  category: "complex",
  description: "Multi-step migration task with constraints",
  userRequest:
    "Migrate our user authentication from session-based to JWT tokens. We need to maintain backward compatibility for mobile clients running older app versions for 90 days.",
  additionalContext: `Current stack:
- Express.js backend with express-session
- PostgreSQL for session storage
- Redis for session cache
- Mobile apps: iOS 3.2.1, Android 4.0.0 (both use session cookies)
- Web app: React SPA

Constraints:
- Zero downtime during migration
- Must pass SOC2 audit in 45 days
- Team: 2 backend devs, 1 mobile dev`,
  mode: "quick",
};
