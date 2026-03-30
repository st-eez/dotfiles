# Security

**Never hardcode PII or env-specific values into files — resolve from config at runtime. Dotfiles are public.**

# Conventions

- **Use current year in web searches (from env "Today's date").**
- **Use absolute paths (`$HOME`, `__dirname`, `__file__`) — never relative (breaks when cwd changes).**
- **Use conventional commit messages: `feat:` | `fix:` | `refactor:` | `docs:` | `chore:`**

# Commands

```sh
# Browser automation: use /steez-browse skill

# Use 'bd' for Task tracking (beads)
bd prime                                  # If not auto-injected by hooks
bd update <id> --add-label <group>        # Always: work area (e.g., browse, upstream-sync). Related beads share a label.
bd update <id> --add-label <worktree>     # When applicable: worktree name (routes work to correct worktree)

# Git worktrees
bd worktree create <name>                 # Never `git worktree add`
```
