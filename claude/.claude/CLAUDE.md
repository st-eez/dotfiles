# Verification

- When corrected: Verify fix before responding—don't repeat the same mistake
- Unclear to user: If user says "I don't understand", break down with concrete examples—don't repeat same explanation
- Scope confirmation: Confirm intended scope before changes affecting multiple targets (hosts, files, configs)

# Tools

- Code-Review Skill: Always use for reviewing Pull Requests
- Web searches: Use current year from env "Today's date" field

# Code

- File paths: Use absolute paths (via `$HOME`, `__dirname`, `__file__`, etc.) not relative paths—code breaks when cwd changes

# Git

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- No AI branding in commits (no signatures, co-authored-by, metadata)
