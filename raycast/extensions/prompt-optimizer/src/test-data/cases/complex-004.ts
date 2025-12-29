import { TestCase } from "../types";

export const testCase: TestCase = {
  id: "complex-004",
  category: "complex",
  description: "Debugging with incomplete information",
  userRequest:
    "Our API is returning 504 Gateway Timeout errors intermittently. They started yesterday after a deployment. Help me debug this.",
  additionalContext: `What we know:
- Deployment: Added caching layer (Redis) for user profiles
- Errors: ~2% of requests to /api/users/:id endpoint
- No errors in other endpoints
- Redis connection pool: 10 connections
- API timeout config: 30s
- Database: response times normal (p99 < 50ms)

Things we've tried:
- Restarted API pods - no change
- Checked Redis memory - 40% used
- No recent DNS changes`,
  mode: "quick",
};
