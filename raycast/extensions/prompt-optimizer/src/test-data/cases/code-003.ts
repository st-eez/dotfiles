import { TestCase } from "../types";

export const testCase: TestCase = {
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
};
