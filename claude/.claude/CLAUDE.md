# Security

**Never hardcode PII or env-specific values into files — resolve from config at runtime. Dotfiles are public.**

# Conventions

- **Use current year in web searches (from env "Today's date").**
- **Use absolute paths (`$HOME`, `__dirname`, `__file__`) — never relative (breaks when cwd changes).**
- **Use conventional commit messages: `feat:` | `fix:` | `refactor:` | `docs:` | `chore:`**

# Commands

```sh
# Playwright (browser automation)
playwright-cli install --skills           # Setup (per-workspace)
playwright-cli eval                       # Extract snapshot values

# Use 'bd' for Task tracking (beads)
bd prime                                  # If not auto-injected by hooks
bd update <id> --add-label <worktree>     # Always, on every issue you touch

# Git worktrees
bd worktree create <name>                 # Never `git worktree add`
```
