# Security

Never hardcode PII or environment-specific values; resolve them from runtime config.

# Conventions

- Use absolute paths in scripts/configs via `$HOME`, `__dirname`, `__filename`, or `pathlib.Path(__file__)`.
- Resolve nickname repo/path references with `zoxide query --list --score -- <name>`, then verify the target before editing.

# Code Changes

- Add dependencies through the project package manager; never hand-edit lockfiles or invent version numbers.
- Validate at system boundaries; do not add fallbacks for impossible internal states.
- Write tests for behavior or regression risk, not constants or ignored inputs.
- Remove unused code directly; no compatibility shells, renamed unused vars, re-export wrappers, or removal placeholders.
- Stay within the asked scope; distinguish fixing a real bug from gold-plating.

# Git

- Commit completed agent-made changes as rollback points.
- Before committing, inspect `git status` and `git diff`; stage only task-relevant files.
- Do not touch git config, push, discard changes, or amend unless asked, except to fold hook edits into your own unpushed commit.
- After committing, report the commit and any remaining uncommitted changes.
- Use Conventional Commits subjects.

# GitHub

- Read PR review comments via `gh api repos/<owner>/<repo>/pulls/<number>/comments` — `gh pr view` omits inline review threads.
- Before opening a PR, review the full `<base>...HEAD` diff.
- PR bodies include `Summary` and `Test plan` sections.

# Verification

- Run the full intended test/build/check scope.
- For bugs, reproduce before editing, fix the source, then verify the same path.
- For noisy commands, capture full logs out-of-band, preserving the exit code.
- Before reporting non-trivial code changes done, invoke the verifier subagent.
- For user-facing or app changes, rebuild, run the app, and confirm the change works at runtime before reporting done.

# Subagents

- For volume fan-outs (Workflow `agent()` calls, large fleets of parallel Agent calls), set `model: "opus"` (Opus 4.8, high or higher effort) explicitly — a big fleet inheriting Fable 5 burns tokens/context for no quality gain.
- For a small number of targeted, quality-sensitive subagents (deep audits, hard searches, adversarial verification), prefer Fable 5; it does better targeted work. Judgment call: scale → opus, depth → fable.

# Communication

- No option menus, emojis, or time estimates.
- Do the work yourself; stop only when genuinely blocked.
- Recommend one approach with a reason; offer alternatives only when asked.
- Match output to the consumer: human-readable for inspection, structured plus `jq` for programmatic use.
- Distinguish verified facts from assumptions. Cite GitHub items as `owner/repo#123`.
- Operator-facing commands must be one short word — wrap operational workflows in tiny CLIs, never hand over raw plumbing.
- Old or stale data: partition it out and surface it as a human decision list; never process it silently.
