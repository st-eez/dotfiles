# Security

**Never hardcode PII or env-specific values into files — resolve from config at runtime. Dotfiles are public.**

# Tools

```sh
# Search (use current year from env "Today's date")
# Paths: use absolute ($HOME, __dirname, __file__) — never relative
# Commits: feat: | fix: | refactor: | docs: | chore:

# Playwright (browser automation)
playwright-cli install --skills           # Setup (per-workspace)
playwright-cli eval                       # Extract snapshot values

# Use 'bd' for Task tracking (beads)
bd prime                                  # If not auto-injected by hooks
bd update <id> --add-label <worktree>     # Always, on every issue you touch

# Git worktrees
bd worktree create <name>                 # Never `git worktree add`
```
