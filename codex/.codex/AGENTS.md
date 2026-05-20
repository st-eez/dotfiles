# Security

Never hardcode PII, API keys, secrets, or environment-specific values; resolve values from config at runtime.

# Conventions

- Use the current year from today's date in web searches.
- Use absolute paths in scripts/configs: `$HOME`, `__dirname`, `__filename`, or `pathlib.Path(__file__)`.
- For nickname repo/path references, resolve with `zoxide query --list --score -- <name>`, then verify the target before editing.
- Use `fd` for path search, `rg` for content search, and `rg --files` for searchable file lists; use `find` only when needed.
- Match output to the consumer: human output for user inspection, structured output plus `jq`/`yq` for programmatic use.
- Search narrowly first; exclude dependency/build/cache/generated/history/session/auth/trash paths unless relevant; narrow noisy results before reasoning from them.
- Distinguish verified facts from assumptions. If something cannot be checked, say so.
- Reference local code as `file_path:line_number`; reference GitHub issues/PRs as `owner/repo#123`.

# Code Changes

- Create files, docs, or scaffolds only when required by the task.
- Add dependencies through the project package manager; do not hand-edit lockfiles or invent versions.
- Validate at system boundaries; do not add fallbacks for impossible internal states.
- Write tests for behavior or regression risk, not constants or ignored inputs.
- Remove unused code directly; no compatibility shells, renamed unused vars, re-export wrappers, or removal placeholders.

# Git

- Commit completed agent-made changes as rollback points; do not commit read-only, blocked, or partial work unless asked.
- Before committing, inspect `git status`, `git diff`, and `git log -5 --oneline`; stage only task-relevant files.
- Never commit unrelated user changes, secrets, env files, credentials, or incomplete work as complete.
- Do not update git config, push, force push, hard reset, discard changes, or amend unless explicitly asked.
- If commit hooks reject, fix the issue and create a new commit.
- After committing, run `git status` and report the commit plus remaining changes.
- Use conventional commits with imperative subjects; explain why in the body when useful.

# GitHub

- Use `gh` for GitHub issues, PRs, checks, releases, and GitHub URLs.
- Before creating a PR, inspect status, diff, upstream state, commits since base, and full branch diff; review every branch change.
- Push only when needed for a PR.
- Create PRs with `gh pr create`, include `Summary` and `Test plan`, and return the URL.
- View PR comments with `gh api repos/<owner>/<repo>/pulls/<number>/comments`.

# Verification

- Run the full intended test/build/check scope; do not reduce coverage to save context or shorten output.
- For noisy commands, capture full logs out-of-band while preserving the real exit code.
- Report only command, pass/fail, suite summary, and failures unless asked for full logs.
- For bugs, reproduce before editing, fix the source, then verify the same path.
- Before reporting non-trivial code changes as done, run relevant checks and diagnostics.
- For non-trivial implementation, invoke the verifier subagent before completion; on FAIL, fix and re-verify; on PARTIAL, report what was and was not verified.
- If work is incomplete or blocked, say so plainly and list what remains.

# Response Style

- No sycophancy, option menus, emojis, or time estimates.
- Recommend one approach with a reason; offer alternatives only when asked.
