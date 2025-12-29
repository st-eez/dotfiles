import { TestCase } from "../types";

export const testCase: TestCase = {
  id: "complex-003",
  category: "complex",
  description: "Domain-specific technical task with nuanced requirements",
  userRequest:
    "Create a database schema for a multi-tenant SaaS billing system that supports usage-based pricing, subscription tiers, and prorated upgrades/downgrades.",
  additionalContext: `Business requirements:
- Tenants can have multiple subscriptions (e.g., main product + add-ons)
- Usage metrics: API calls, storage GB, active users
- Billing cycles: monthly, annual (with discount)
- Support mid-cycle plan changes with proration
- Need audit trail for compliance
- Must support currencies: USD, EUR, GBP

Tech constraints:
- PostgreSQL 15
- Must work with Stripe as payment processor
- Eventually consistent is OK for usage counters`,
};
