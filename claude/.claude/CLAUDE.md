# Security

Never hardcode secrets, credentials, PII, or environment-specific values; resolve them from runtime config (these dotfiles are public).

# Conventions

- Use the current year from today's date in web searches.
- Use absolute paths in scripts/configs via `$HOME`, `__dirname`, `__filename`, or `pathlib.Path(__file__)`.
- Resolve nickname repo/path references with `zoxide query --list --score -- <name>`, then verify the target before editing.
- Search narrowly first with `fd` for paths, `rg` for content, and `rg --files` for file lists; use `find` only when needed, and narrow noisy results before reasoning from them.

# Code Changes

- Add dependencies through the project package manager; never hand-edit lockfiles or invent version numbers.
- Validate at system boundaries; do not add fallbacks for impossible internal states.
- Write tests for behavior or regression risk, not constants or ignored inputs.
- Remove unused code directly; no compatibility shells, renamed unused vars, re-export wrappers, or removal placeholders.
- Stay within the asked scope; do not expand work, clean up unrelated things, or spawn more agents than requested, and distinguish fixing a real bug from gold-plating.

# Git

- Commit completed agent-made changes as rollback points; do not commit read-only, blocked, or partial work unless asked.
- Before committing, inspect `git status`, `git diff`, and `git log -5 --oneline`; stage only task-relevant files.
- Do not update git config, push, force push, hard reset, discard changes, or amend unless explicitly asked; exception: amend your own unpushed commit when a pre-commit hook auto-modified files during a successful commit.
- If hooks reject, fix and create a new commit; after committing, run `git status` and report the commit plus remaining changes.
- Use conventional imperative commit subjects; explain why in the body when useful.

# GitHub

- Read PR review comments via `gh api repos/<owner>/<repo>/pulls/<number>/comments` — `gh pr view` omits inline review threads.
- Before opening a PR, review the full branch diff and every commit since base, not just the latest commit.
- PR bodies include `Summary` and `Test plan` sections; return the PR URL.

# Verification

- Run the full intended test/build/check scope; do not reduce coverage to save context or shorten output.
- For bugs, reproduce before editing, fix the source, then verify the same path.
- For noisy commands, capture full logs out-of-band while preserving exit code; report only command, pass/fail, suite summary, and failures unless asked.
- Before reporting non-trivial code changes done, invoke the verifier subagent; fix and re-verify on FAIL, report gaps on PARTIAL.
- For user-facing or app changes, rebuild and launch/run the app (or test in the live sandbox) and confirm it works at runtime before reporting done; passing checks alone is not completion.

# Communication

- No sycophancy, option menus, emojis, or time estimates.
- Do the work yourself; do not defer or block on the user for actions you can perform, and stop only when genuinely blocked.
- Recommend one approach with a reason; offer alternatives only when asked.
- Match output to the consumer: human-readable for inspection, structured plus `jq` for programmatic use.
- Distinguish verified facts from assumptions; if something cannot be checked, say so. Cite local code as `file_path:line_number` and GitHub items as `owner/repo#123`.
