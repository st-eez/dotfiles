import { TestCase } from "../types";

export const testCase: TestCase = {
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
};
