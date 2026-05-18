# Security

**Never hardcode PII, API keys, secrets, or env-specific values into files — resolve from config at runtime. Dotfiles are public.**

# Conventions

- **Use current year in web searches (from env "Today's date").**
- **Use absolute paths (`$HOME`, `__dirname`, `__filename`, `pathlib.Path(__file__)`) in scripts and configs — never relative (breaks when cwd changes).**
- **When the user references a repo/directory by nickname and no explicit path is given, infer it with `zoxide query --list --score -- <name>`. Prefer the top match when it is clearly higher-confidence, then quickly verify the path/listing before editing.**
- **When using shell commands, use `fd` for path/name search, `rg` for content search, and `rg --files` when you need ripgrep’s searchable file list. Use `find` for POSIX/metadata-heavy queries or when `fd` is unavailable.**
- **Match output format to its consumer.** If the next consumer is the user (display, inspection, summary), use the CLI's native human output. If the next consumer is code (extract, filter, count, transform, pipe), request structured output (`--json`, `--csv`, etc.) and process it with a structured tool (`jq`, `yq`, etc.). Don't parse human output programmatically; don't pipe structured output through a transformer just to print it.
- **Search hygiene:** Scope to the smallest relevant tree first; exclude dependency/build/cache/generated/history/session/auth/trash paths by default; prefer fixed-string searches for literals; avoid bare short/common tokens; treat noisy or truncated output as invalid evidence and narrow before reasoning from it.
- **Distinguish verified facts from assumptions; if a claim cannot be checked, say what is unverified.**
- **Use `file_path:line_number` when referencing code.** Use `owner/repo#123` for GitHub issues/PRs so they render as clickable links.

# Git

- Commit completed agent-made changes frequently as local rollback points. Do not commit read-only, blocked, or partial work unless the user asks for a WIP checkpoint.
- Before staging or committing, run `git status`, `git diff`, and `git log -5 --oneline`; inspect untracked files, the exact diff, and recent commit style.
- Stage only task-relevant files, preferably agent-made changes. Never commit unrelated user changes, secrets, env files, credential files, or incomplete work as complete.
- Never update git config, push, force push, reset hard, or discard changes unless explicitly requested.
- Avoid `git commit --amend`; only amend when the user asks, or when your successful unpushed commit was modified by hooks.
- If commit fails or hooks reject it, fix the issue and create a new commit. Never amend a failed/rejected commit.
- After committing, run `git status` and report the commit plus remaining changes.
- Use conventional commits: `feat:` | `fix:` | `refactor:` | `docs:` | `chore:` | `test:` | `perf:` | `ci:` | `build:`. Imperative subject, no trailing period. Body explains WHY, not WHAT.

# GitHub

- Use `gh` via shell for GitHub issues, pull requests, checks, releases, and GitHub URLs.
- Before creating a PR, inspect `git status`, `git diff`, upstream state, `git log <base>..HEAD --oneline`, and `git diff <base>...HEAD`.
- Review every commit and change since branch divergence, not just the latest commit.
- Push only when needed to create or update the PR.
- Create PRs with `gh pr create`; use a structured body with `Summary` and `Test plan`, then return the PR URL.
- View PR comments with `gh api repos/<owner>/<repo>/pulls/<number>/comments`.

# Test Output

- Run the full intended test/build/check scope; do not reduce coverage to save context or shorten output.
- For noisy commands, or commands likely to print many passing lines, capture full logs out-of-band while preserving the command's real exit code.
- Report only the command, pass/fail status, suite summary, and failing tests/errors/diffs/stack context.
- Do not stream passing test lines or full logs unless the user asks, or unless filtering would hide necessary failure context.

# Debugging

- For bugs and behavioral regressions, reproduce the symptom before editing.
- Fix the source, then re-run or re-observe the same path to verify the symptom is gone.
- Use the relevant evidence path: failing command, built file, rendered page, URL, logs, or runtime behavior.

# Completion

- Before reporting a non-trivial code change as done, run relevant build/tests/lint and check diagnostics when available.
- Non-trivial changes include 3+ file edits, backend/API changes, regression-risk bug fixes, infrastructure-adjacent work, or failures that would be easy to miss.
- For non-trivial implementation, invoke the verifier subagent for independent adversarial verification before reporting completion. Only the verifier assigns the verdict.
- On FAIL, fix and re-verify. On PARTIAL, report what passed and what could not be verified.
- If work is incomplete or blocked, say so plainly and list what remains.

# Anti-patterns

- **No sycophancy.** No "Great question!", "I'd be happy to help!", "That's a really interesting approach, but...", or similar.
- **No option menus.** Pick one approach and recommend it, explain why in one sentence. Offer alternatives only if the USER explicitly asks.
- **No emojis** in responses or generated files unless explicitly asked.
- **No time estimates.** Focus on what needs to be done, not how long it might take.
