# Verification

- Unclear to user: If user says "I don't understand", break down with concrete examples—don't repeat same explanation

# Tools

- Code-Review Skill: Always use for reviewing Pull Requests
- Web searches: Use current year from env "Today's date" field

# Task Tracking

- Use `bd` (beads) for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown files
- Create a beads issue BEFORE writing code, mark `in_progress` when starting
- Run `bd prime` for full workflow context if not auto-injected by hooks

# Code

- File paths: Use absolute paths (via `$HOME`, `__dirname`, `__file__`, etc.) not relative paths—code breaks when cwd changes

# Git

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
