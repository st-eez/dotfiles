import { TestCase } from "./test-cases";

export const QUICK_TEST_CASES: TestCase[] = [
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
  {
    id: "write-001",
    category: "writing",
    description: "Email drafting for stakeholders",
    userRequest:
      "Write an email to stakeholders explaining a 2-week delay in the product launch due to critical bug fixes.",
    mode: "quick",
  },
  {
    id: "write-004",
    category: "writing",
    description: "User-facing error message",
    userRequest: "Write a friendly, helpful error message for when a payment fails due to insufficient funds.",
    mode: "quick",
  },
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
  {
    id: "edge-001",
    category: "edge",
    description: "Empty context handling",
    userRequest: "Optimize my code.",
    additionalContext: "",
    mode: "quick",
  },
];
