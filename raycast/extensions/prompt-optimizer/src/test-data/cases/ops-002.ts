import { TestCase } from "../types";

export const testCase: TestCase = {
  id: "ops-002",
  category: "ops",
  description: "API load testing and performance validation strategy",
  userRequest:
    "Design a comprehensive load testing strategy for our payment API before Black Friday. We expect 10x normal traffic.",
  additionalContext: `Current baseline:
- Normal traffic: 500 req/s
- Expected peak: 5000 req/s
- P99 latency target: <200ms
- Error rate target: <0.1%

API endpoints to test:
- POST /api/v1/payments/initiate (most critical)
- POST /api/v1/payments/confirm
- GET /api/v1/payments/:id/status
- POST /api/v1/refunds

Infrastructure:
- 3 API pods (auto-scaling enabled, max 20)
- PostgreSQL primary + 2 read replicas
- Redis cluster for session/cache
- Stripe as payment processor (has own rate limits)

Constraints:
- Cannot test against production Stripe (use sandbox)
- Must complete testing within 2-week window
- Need signoff from security team before live test`,
};
