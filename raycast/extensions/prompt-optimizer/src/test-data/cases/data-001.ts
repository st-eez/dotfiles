import { TestCase } from "../types";

export const testCase: TestCase = {
  id: "data-001",
  category: "data-analysis",
  description: "Log analysis for errors",
  userRequest: "Analyze these error logs and identify the root cause of the service degradation.",
  additionalContext: `2025-12-26 10:15:22 ERROR [api-gateway] Connection refused to auth-service:8080
2025-12-26 10:15:23 ERROR [api-gateway] Connection refused to auth-service:8080
2025-12-26 10:15:24 WARN [auth-service] Memory usage at 95%
2025-12-26 10:15:25 ERROR [auth-service] OOMKilled by kubernetes
2025-12-26 10:15:26 INFO [kubernetes] Restarting pod auth-service-7b4d9c
2025-12-26 10:15:45 INFO [auth-service] Service started
2025-12-26 10:16:22 ERROR [auth-service] OOMKilled by kubernetes`,
};
