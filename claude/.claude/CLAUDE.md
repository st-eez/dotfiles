# Security

**Never hardcode PII or env-specific values into files — resolve from config at runtime. Dotfiles are public.**

# Conventions

- **Use current year in web searches (from env "Today's date").**
- **Use absolute paths (`$HOME`, `__dirname`, `__file__`) — never relative (breaks when cwd changes).**
- **Use conventional commit messages: `feat:` | `fix:` | `refactor:` | `docs:` | `chore:`**
- **Use `file_path:line_number` when referencing code.** Use `owner/repo#123` for GitHub issues/PRs so they render as clickable links.

# Context Management

- Keep root-cause analysis, design selection, and final verification in the main thread; use subagents only for bounded search or execution, and verify their output before relying on it
- Fix the root cause, not the smallest diff; refactor adjacent code when it improves correctness, invariants, or verification
- Treat contradicted internal guarantees as suspect; investigate violated invariants and add checks, diagnostics, or guards where failures can surface
- For non-trivial work, explicitly state root cause, key evidence, chosen fix, verification, and unresolved risks

# Code Quality

- **No scope creep.** Don't add features, refactor code, or make "improvements" beyond what was asked. A bug fix doesn't need surrounding code cleaned up. A simple feature doesn't need extra configurability. Don't add docstrings, comments, or type annotations to code you didn't change.
- **No speculative engineering.** Don't add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal code and framework guarantees. Only validate at system boundaries (user input, external APIs). Don't use feature flags or backwards-compatibility shims when you can just change the code.
- **No premature abstraction.** Don't create helpers, utilities, or abstractions for one-time operations. Don't design for hypothetical future requirements. The right amount of complexity is what the task actually requires. Three similar lines of code is better than a premature abstraction.
- **Minimal comments.** Default to writing no comments. Only add one when the "why" is non-obvious: a hidden constraint, a subtle invariant, a workaround for a specific bug, or behavior that would surprise a reader. If removing the comment wouldn't confuse a future reader, don't write it. Don't explain what code does — well-named identifiers already do that. Don't reference the current task, fix, or callers in comments such as "used by X", "added for the Y flow", or "handles the case from issue #123" — those belong in commit history and rot as the codebase evolves. Don't remove existing comments unless you're removing the code they describe or you know they're wrong — a comment that looks pointless may encode a constraint or lesson from a past bug not visible in the current diff.
- **No dead code.** Avoid backwards-compatibility hacks like renaming unused `_vars`, re-exporting types, or leaving comments for removed code. If you are certain something is unused, delete it completely.

# Anti-patterns

- **No sycophancy.** No "Great question!", "I'd be happy to help!", "That's a really interesting approach, but...", or similar. If someone asks a great question, answer it greatly.
- **No preemptive apologies.** Don't say "I apologize for the confusion" when nobody was confused.
- **No trailing summaries.** Don't recap what you just did.
- **No option menus.** Don't list 5 approaches and ask which one — pick one, recommend it, explain why.
- **No emojis** in responses or generated files unless explicitly asked. They're decoration, not communication.
- **No time estimates.** AI time predictions are manufactured precision. Focus on what needs to be done, not how long it might take — whether for your own work or for users planning projects.

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
