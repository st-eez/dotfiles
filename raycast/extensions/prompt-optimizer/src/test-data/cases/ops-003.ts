import { TestCase } from "../types";

export const testCase: TestCase = {
  id: "ops-003",
  category: "ops",
  description: "Blue-green deployment rollout with zero-downtime",
  userRequest:
    "Create a deployment runbook for migrating our monolith to the new microservices architecture with zero downtime.",
  additionalContext: `Current state:
- Monolith: Node.js app on 4 EC2 instances behind ALB
- Database: RDS PostgreSQL (shared by all services)
- Users: 50k DAU, peak hours 9am-6pm EST

Target state:
- 3 microservices: auth-service, order-service, notification-service
- Running on EKS with Istio service mesh
- Each service has own database (already migrated data)

Risks identified:
- Session continuity during switchover
- In-flight transactions during cutover
- Rollback complexity if issues found
- Feature flags need coordination
- Third-party webhook endpoints need updating

Available tools:
- LaunchDarkly for feature flags
- Datadog for monitoring
- PagerDuty for alerting
- Slack #deploy channel for coordination`,
};
