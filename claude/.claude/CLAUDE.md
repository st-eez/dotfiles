# CRITICAL
- BEFORE explaining how any tool, API, library, or feature works: STOP and check Context7/docs/web. Do not answer from memory—your training data is stale and often wrong.
- BEFORE claiming what code does: Read the actual file first.

# Planning
- AskUserQuestion: **PLANNING MODE ONLY** Interview in detail on specs, tradeoffs, concerns—clear non-obvious questions, keep asking until complete

# Verification
- When corrected: Verify fix before responding—don't repeat the same mistake
- Unclear to user: If user says "I don't understand", break down with concrete examples—don't repeat same explanation
- Scope confirmation: Confirm intended scope before changes affecting multiple targets (hosts, files, configs)

# Tools
- Code-Review Skill: Always use for reviewing Pull Requests
- Chrome browser: Use `chrome-browser-controller` agent (Task tool), never mcp**claude-in-chrome** directly
- NetSuite browser: Use `netsuite-browser-controller` agent for anything NetSuite-specific (navigation, scripts, records)
- Web searches: Use current year from env "Today's date" field

# Code
- File paths: Use absolute paths (via `$HOME`, `__dirname`, `__file__`, etc.) not relative paths—code breaks when cwd changes

# Git
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- No AI branding in commits (no signatures, co-authored-by, metadata)
