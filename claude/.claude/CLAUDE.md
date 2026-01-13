# Important

- Do not write code before stating assumptions
- Don't claim correctness without verification
- Consider edge cases and failure modes, not just the happy path
- Identify conditions and constraints for solutions to work

# Rules

1. AskUserQuestion: Always interview me in detail about specs—technical implementation, UI & UX, concerns, tradeoffs, etc. using the AskUserQuestion Tool.
   Make sure questions are not obvious. Be in-depth and keep interviewing until complete.
2. Context7: Fetch library docs via MCP before code generation
3. Chrome browser: For general web browsing - use `chrome-browser-controller` agent (Task tool), never mcp__claude-in-chrome__ directly
4. NetSuite browser: For anything NetSuite-specific (navigation, scripts, records) - use `netsuite-browser-controller` agent (Task tool) instead of chrome-browser-controller
5. Web searches: Use current year from env "Today's date" field
6. Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
7. No AI branding in commits (no signatures, co-authored-by, metadata)
