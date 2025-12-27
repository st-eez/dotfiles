/**
 * Test Dataset for A/B Testing Framework
 *
 * 20 diverse test cases across 6 categories.
 * Includes 2 migrated test cases from the original test-ab-runner.ts.
 */

export interface TestCase {
  id: string;
  category: string;
  description: string;
  userRequest: string;
  additionalContext?: string;
  persona?: string;
  mode: "quick" | "detailed";
}

export const TEST_CASES: TestCase[] = [
  // === CODE TASKS (5) ===
  {
    id: "code-001",
    category: "code",
    description: "Refactoring a complex function",
    userRequest: "Refactor this function to use async/await instead of callbacks and add proper error handling.",
    additionalContext: `function fetchUserData(userId, callback) {
  db.query('SELECT * FROM users WHERE id = ?', [userId], function(err, result) {
    if (err) {
      callback(err, null);
      return;
    }
    api.getDetails(result.id, function(err2, details) {
      if (err2) {
        callback(err2, null);
        return;
      }
      callback(null, { ...result, details });
    });
  });
}`,
    mode: "quick",
  },
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
    id: "code-003",
    category: "code",
    description: "Code review for security",
    userRequest: "Review this authentication code for security vulnerabilities.",
    additionalContext: `app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.query(\`SELECT * FROM users WHERE username = '\${username}' AND password = '\${password}'\`);
  if (user) {
    req.session.user = user;
    res.redirect('/dashboard');
  } else {
    res.send('Invalid credentials');
  }
});`,
    mode: "quick",
  },
  {
    id: "code-004",
    category: "code",
    description: "API design for REST endpoint",
    userRequest: "Design a RESTful API for a todo application with CRUD operations, filtering, and pagination.",
    mode: "detailed",
  },
  {
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
  },

  // === WRITING TASKS (4) ===
  {
    id: "write-001",
    category: "writing",
    description: "Email drafting for stakeholders",
    userRequest:
      "Write an email to stakeholders explaining a 2-week delay in the product launch due to critical bug fixes.",
    mode: "quick",
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
    id: "write-004",
    category: "writing",
    description: "User-facing error message",
    userRequest: "Write a friendly, helpful error message for when a payment fails due to insufficient funds.",
    mode: "quick",
  },

  // === SYSTEM DESIGN (3) ===
  {
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

  // === DATA ANALYSIS (3) ===
  {
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
    mode: "quick",
  },
  {
    id: "data-002",
    category: "data-analysis",
    description: "Metrics interpretation for A/B test",
    userRequest: "Interpret these A/B test results and recommend whether to ship the variant.",
    additionalContext: `Control (n=10000): Conversion 2.1%, Avg Revenue $45.20
Variant (n=10000): Conversion 2.4%, Avg Revenue $43.80
p-value for conversion: 0.048
p-value for revenue: 0.12`,
    mode: "quick",
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

  // === SIMPLE QUESTIONS (3) ===
  {
    id: "simple-001",
    category: "simple",
    description: "Quick lookup",
    userRequest: "What is the difference between localStorage and sessionStorage?",
    mode: "quick",
  },
  {
    id: "simple-002",
    category: "simple",
    description: "Explanation request",
    userRequest: "Explain the CAP theorem in simple terms.",
    mode: "quick",
  },
  {
    id: "simple-003",
    category: "simple",
    description: "Technology comparison",
    userRequest: "Compare PostgreSQL and MongoDB for a social media application.",
    mode: "quick",
  },

  // === EDGE CASES (2) ===
  {
    id: "edge-001",
    category: "edge",
    description: "Empty context handling",
    userRequest: "Optimize my code.",
    additionalContext: "",
    mode: "quick",
  },
  {
    id: "edge-002",
    category: "edge",
    description: "Long input with special characters and unicode",
    userRequest:
      "Analyze this international e-commerce order data with special characters and provide insights on regional performance.",
    additionalContext: `订单数据 (2025年12月):
北京 🇨🇳: ¥1,234,567 (增长 +15.3%)
東京 🇯🇵: ¥98,765,432 (成長 +8.7%)
서울 🇰🇷: ₩9,876,543,210 (성장 +12.1%)
München 🇩🇪: €234,567 (Wachstum +5.2%)
São Paulo 🇧🇷: R$1,234,567 (crescimento +18.9%)

Top Categories:
1. 电子产品/電子製品/전자제품 - ↑22%
2. 时尚服装/ファッション/패션 - ↑15%
3. 家居用品/ホーム用品/가정용품 - ↑10%

Issues: Cart abandonment in APAC region shows unusual pattern—investigate "配送料金" complaints.
Customer feedback: "送料が高すぎる！" "배송비가 너무 비싸요" "运费太贵了"

Technical note: UTF-8 encoding required for all报表/レポート/보고서.`,
    mode: "detailed",
  },
];

/**
 * Get test cases by category.
 */
export function getTestCasesByCategory(category: string): TestCase[] {
  return TEST_CASES.filter((tc) => tc.category === category);
}

/**
 * Get a test case by ID.
 */
export function getTestCaseById(id: string): TestCase | undefined {
  return TEST_CASES.find((tc) => tc.id === id);
}
