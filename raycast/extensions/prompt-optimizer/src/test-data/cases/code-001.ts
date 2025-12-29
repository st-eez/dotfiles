import { TestCase } from "../types";

export const testCase: TestCase = {
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
};
