# Security

**Never hardcode PII or env-specific values into files — resolve from config at runtime. Dotfiles are public.**

# Conventions

- **Use current year in web searches (from env "Today's date").**
- **Use absolute paths (`$HOME`, `__dirname`, `__file__`) — never relative (breaks when cwd changes).**
- **Use conventional commit messages: `feat:` | `fix:` | `refactor:` | `docs:` | `chore:`**

# Context Management

- Keep root-cause analysis, design selection, and final verification in the main thread; use subagents only for bounded search or execution, and verify their output before relying on it
- Fix the root cause, not the smallest diff; refactor adjacent code when it improves correctness, invariants, or verification
- Treat contradicted internal guarantees as suspect; investigate violated invariants and add checks, diagnostics, or guards where failures can surface
- For non-trivial work, explicitly state root cause, key evidence, chosen fix, verification, and unresolved risks

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
