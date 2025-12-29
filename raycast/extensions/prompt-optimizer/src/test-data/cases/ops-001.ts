import { TestCase } from "../types";

export const testCase: TestCase = {
  id: "ops-001",
  category: "ops",
  description: "Database query optimization with execution plan analysis",
  userRequest:
    "Optimize this PostgreSQL query that's timing out in production. The users table has 2M rows and orders has 50M rows.",
  additionalContext: `-- Current query (takes 45s+)
SELECT u.id, u.email, COUNT(o.id) as order_count, SUM(o.total) as lifetime_value
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.created_at > '2024-01-01'
  AND u.status = 'active'
GROUP BY u.id, u.email
HAVING COUNT(o.id) > 5
ORDER BY lifetime_value DESC
LIMIT 100;

-- Existing indexes:
-- users: PRIMARY KEY (id), INDEX (email), INDEX (status)
-- orders: PRIMARY KEY (id), INDEX (user_id), INDEX (created_at)

-- EXPLAIN ANALYZE output:
-- Sort (cost=892341.23..892341.48 rows=100)
--   -> HashAggregate (cost=891234.56..892234.56 rows=100000)
--        -> Hash Left Join (cost=12345.67..789012.34 rows=2500000)
--             -> Seq Scan on users (cost=0.00..45678.00 rows=500000)
--             -> Hash (cost=9876.54..9876.54 rows=50000000)`,
};
