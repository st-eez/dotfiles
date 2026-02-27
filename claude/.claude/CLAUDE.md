# Tools

```sh
# Use the Code-Review skill for PRs
# Use current year in web searches (from env "Today's date")
# Use remindctl for Apple Reminders
remindctl lists | add | complete | edit

# Playwright (browser automation)
playwright-cli install --skills          # Setup (per-workspace)
playwright-cli eval                      # Extract snapshot values
# Never `Read` full snapshot files — `Grep` on YAML instead (token waste)
```

# Task Tracking

```sh
# 1. Use 'bd' for task tracking
bd prime                                 # If not auto-injected by hooks

# 2. Label issues with worktree
bd update <id> --add-label <worktree>    # Always, on every issue you touch
```

# Code

```sh
# Use absolute paths ($HOME, __dirname, __file__) — never relative (breaks when cwd changes)
```

# Tmux

```sh
# Always send text and Enter as separate commands
tmux send-keys -t <session>:<window> "the text"
tmux send-keys -t <session>:<window> Enter
# Don't: tmux send-keys "text" Enter — Enter swallowed as newline
```

# Git

```sh
# Use conventional commit messages
feat: | fix: | refactor: | docs: | chore:

# Use bd for worktrees
bd worktree create <name>               # Not `git worktree add` — sets up .beads/redirect
```
