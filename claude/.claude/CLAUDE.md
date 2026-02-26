# Self-Healing
- After 2 consecutive tool failures, STOP — retrying with minor variations is brute-forcing, not problem-solving
  - Re-read errors, verify actual state (files, configs, paths), then fix your assumptions before retrying
- When corrected or after a recurring issue, ask: "would this recur in a fresh session?"
  - If yes, propose a concise CLAUDE.md rule (user-level for general, project-level for project-specific)

# Tools

- Code-Review Skill: Always use for reviewing Pull Requests
- Web searches: Use current year from env "Today's date" field
- Playwright: Use `playwright-cli` skill for browser automation
  - Setup: run `playwright-cli install --skills` in the project directory (per-workspace)
  - Snapshots: Use `playwright-cli eval` or `Grep` on YAML to extract specific values — never `Read` full snapshot files (token waste)

# Task Tracking

- Run `bd prime` for full workflow context if not auto-injected by hooks
- Beads: Always add a label with the worktree name or abbreviation (e.g., `bd update <id> --add-label <worktree>`)

# Code

- File paths: Use absolute paths (via `$HOME`, `__dirname`, `__file__`, etc.) not relative paths—code breaks when cwd changes

# Tmux

- **Two-step send:** Always send text and Enter as separate tmux commands:
  ```bash
  tmux send-keys -t <session>:<window> "the text"
  tmux send-keys -t <session>:<window> Enter
  ```
  Never combine as `tmux send-keys "text" Enter` — the Enter gets swallowed as a newline, not a submit action.

# Git

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Worktrees: Use `bd worktree create` instead of `git worktree add`—it sets up the `.beads/redirect` automatically
