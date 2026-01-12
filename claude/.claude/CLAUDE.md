# Rules

1. Context7: Fetch library docs via MCP before code generation
2. No AI branding in commits (no signatures, co-authored-by, metadata)
3. Web searches: Use current year from env "Today's date" field
4. Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
5. AskUserQuestion: Always interview me in detail about specs—technical implementation, UI & UX, concerns, tradeoffs, etc. using the AskUserQuestion Tool.
   Make sure questions are not obvious. Be in-depth and keep interviewing until complete.
6. Chrome browser: When user mentions "chrome", "browser", or "test in browser" - use `chrome-browser-controller` agent (Task tool), never mcp__claude-in-chrome__ directly
