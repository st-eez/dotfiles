# Security

**Never hardcode PII or env-specific values into files — resolve from config at runtime. Dotfiles are public.**

# Tools

**Use current year in web searches (from env "Today's date").**
**Use absolute paths ($HOME, **dirname, **file\_\_) — never relative (breaks when cwd changes).**
**Use conventional commit messages: `feat:` | `fix:` | `refactor:` | `docs:` | `chore:`**

```sh
# Browser automation: use /steez-browse skill

# Jira (acli) — use `workitem`, not `issue`
Always exclude terminal statuses: status NOT IN ("Done","Closed","Canceled")
Use NOT IN, never != (shell escapes !)
acli jira workitem search --jql '...'            # JQL only, no shorthand flags

# Use 'bd' for Task tracking (beads)
bd prime                                  # If not auto-injected by hooks
bd update <id> --add-label <worktree>     # Always, on every issue you touch

# Tmux — always send text and Enter as separate commands
tmux send-keys -t <session>:<window> "the text"
tmux send-keys -t <session>:<window> Enter
# Don't: tmux send-keys "text" Enter — Enter swallowed as newline

# Git worktrees
bd worktree create <name>                 # Never `git worktree add`
```
