import { TestCase } from "./test-cases";

export function generateLongContext(targetLength: number = 8000): string {
  const logEntry = (i: number) =>
    `2025-12-26 ${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00 INFO [service-${i % 10}] Processing request id=${i * 1000} user=user_${i % 100} action=UPDATE latency=${50 + (i % 200)}ms status=OK\n`;

  let context = "";
  let i = 0;
  while (context.length < targetLength) {
    context += logEntry(i++);
  }
  return context;
}

export const DETAILED_TEST_CASES: TestCase[] = [
  {
    id: "code-002",
    category: "code",
    description: "Debugging a race condition",
    userRequest: "Debug this code. Users report intermittent duplicate entries in the database.",
    additionalContext: `async function createOrder(userId, items) {
  const existingOrder = await Order.findOne({ userId, status: 'pending' });
  if (!existingOrder) {
    await Order.create({ userId, items, status: 'pending' });
  }
  return Order.findOne({ userId, status: 'pending' });
}`,
    mode: "detailed",
  },
  {
    id: "code-004",
    category: "code",
    description: "API design for REST endpoint",
    userRequest: "Design a RESTful API for a todo application with CRUD operations, filtering, and pagination.",
    mode: "detailed",
  },
  {
    id: "write-002",
    category: "writing",
    description: "Blameless post-mortem (migrated TC-002)",
    userRequest: "Write a blameless post-mortem for a 4-hour downtime caused by a locked users table migration.",
    mode: "detailed",
  },
  {
    id: "write-003",
    category: "writing",
    description: "Technical documentation for API",
    userRequest: "Write developer documentation for an OAuth2 authentication flow including code examples.",
    mode: "detailed",
  },
  {
    id: "design-002",
    category: "system-design",
    description: "Scaling strategy for microservice",
    userRequest:
      "Design a scaling strategy for a notification service that handles 10M push notifications per day with 99.9% delivery SLA.",
    mode: "detailed",
  },
  {
    id: "design-003",
    category: "system-design",
    description: "Integration design for third-party API",
    userRequest:
      "Design an integration architecture for consuming the Stripe API with retry logic, idempotency, and webhook handling.",
    mode: "detailed",
  },
  {
    id: "data-003",
    category: "data-analysis",
    description: "Anomaly detection in time series",
    userRequest: "This API latency data shows unusual patterns. Identify the anomalies and hypothesize causes.",
    additionalContext: `Hour | P50 (ms) | P99 (ms) | Error Rate
00:00 | 45 | 120 | 0.1%
06:00 | 48 | 125 | 0.1%
09:00 | 52 | 180 | 0.2%
12:00 | 55 | 450 | 0.5%
15:00 | 180 | 2500 | 3.2%
18:00 | 60 | 200 | 0.3%
21:00 | 47 | 122 | 0.1%`,
    mode: "detailed",
  },
  {
    id: "edge-002",
    category: "edge",
    description: "Long prompt stress test",
    userRequest: "Analyze these service logs and identify patterns that might indicate a memory leak.",
    additionalContext: generateLongContext(8000),
    mode: "detailed",
  },
];
