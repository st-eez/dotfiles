# Security

Never hardcode secrets, credentials, PII, or environment-specific values; resolve them from runtime config.

# Conventions

- Use the current year from today's date in web searches.
- Use absolute paths in scripts/configs via `$HOME`, `__dirname`, `__filename`, or `pathlib.Path(__file__)`.
- Resolve nickname repo/path references with `zoxide query --list --score -- <name>`, then verify the target before editing.
- Search narrowly first with `fd` for paths, `rg` for content, and `rg --files` for file lists; use `find` only when needed, and narrow noisy results before reasoning from them.

# Code Changes

- Create files, docs, scaffolds, or dependencies only when required; add dependencies through the project package manager and do not hand-edit lockfiles or invent versions.
- Validate at system boundaries; do not add fallbacks for impossible internal states.
- Write tests for behavior or regression risk, not constants or ignored inputs.
- Remove unused code directly; no compatibility shells, renamed unused vars, re-export wrappers, or removal placeholders.

# Git

- Commit completed agent-made changes as rollback points; do not commit read-only, blocked, or partial work unless asked, and never commit unrelated user changes, secrets, env files, credentials, or incomplete work as complete.
- Before committing, inspect `git status`, `git diff`, and `git log -5 --oneline`; stage only task-relevant files.
- Do not update git config, push, force push, hard reset, discard changes, or amend unless explicitly asked.
- If hooks reject, fix and create a new commit; after committing, run `git status` and report the commit plus remaining changes.
- Use conventional imperative commit subjects; explain why in the body when useful.

# GitHub

- Use `gh` for GitHub issues, PRs, checks, releases, URLs, and PR comments.
- Before creating a PR, inspect status, diff, upstream state, commits since base, and the full branch diff; review every branch change and push only when needed.
- Create PRs with `gh pr create`, include `Summary` and `Test plan`, and return the URL.

# Verification

- Run the full intended test/build/check scope; do not reduce coverage to save context or shorten output.
- For bugs, reproduce before editing, fix the source, then verify the same path.
- For noisy commands, capture full logs out-of-band while preserving exit code; report only command, pass/fail, suite summary, and failures unless asked.
- Before reporting non-trivial code changes as done, run relevant checks and diagnostics and invoke the verifier subagent; then fix and re-verify on FAIL, or report gaps on PARTIAL.
- If work is incomplete or blocked, say so plainly and list what remains.

# Communication

- No sycophancy, option menus, emojis, or time estimates.
- Recommend one approach with a reason; offer alternatives only when asked.
- Match output to the consumer: human-readable for inspection, structured plus `jq`/`yq` for programmatic use.
- Distinguish verified facts from assumptions; if something cannot be checked, say so. Cite local code as `file_path:line_number` and GitHub items as `owner/repo#123`.
