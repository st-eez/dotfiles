# Security & Paths

- Never hardcode PII or environment-specific values; resolve them from runtime config.
- Persistent scripts/configs derive paths from `$HOME`, the repo root, `__dirname`, `__filename`, or `pathlib.Path(__file__)` — never literal machine paths.
- Resolve nickname repo/path references with `zoxide query --list --score -- <name>`, then verify the target before editing.

# Code Changes

- Add dependencies through the project package manager; never hand-edit lockfiles or invent version numbers.
- Validate at system boundaries; do not add fallbacks for impossible internal states.
- When a correction embodies a principle, sweep sibling instances of the class in scope and route the principle to its durable home (tooling > skill > project docs) — never repair only the named instance.
- Write tests for behavior or regression risk, not constants or ignored inputs.
- Remove unused code directly; no compatibility shells, renamed unused vars, re-export wrappers, or removal placeholders.
- If local logic needs a paragraph-long comment, the code is wrong — refactor it. Long comments are only for external constraints or design rationale the code cannot express.
- Stay within the asked scope; distinguish fixing a real bug from gold-plating.

# Git

- Commit completed agent-made changes as rollback points, with Conventional Commits subjects.
- Before committing, inspect `git status` and `git diff`; stage only task-relevant files.
- Do not touch git config, push, discard changes, or amend unless asked, except to fold hook edits into your own unpushed commit.
- After committing, report the commit and any remaining uncommitted changes.

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
- Size fleets to the task: for fan-outs beyond ~10 agents, state the agent count and rough token cost and get a go before launching. On re-entry, resume from the last completed stage — never re-run a whole workflow. Validate against a small sample (20–100 records) before any full-dataset run.

# Communication

- No option menus, emojis, or time estimates.
- Recommend one approach with a reason; offer alternatives only when asked.
- Match output to the consumer: human-readable for inspection, structured plus `jq` for programmatic use.
- Distinguish verified facts from assumptions. Cite GitHub items as `owner/repo#123`.
- Operator-facing commands must be one short word — wrap operational workflows in tiny CLIs, never hand over raw plumbing.
- Old or stale data: partition it out and surface it as a human decision list; never process it silently.

## Response Shape

- Answer/outcome first; no preamble or closing filler. Plain eli15 language
  by default: short sentences, everyday words, one idea per sentence;
  technical terms only when they name the actual thing.
- A message carries what the reader needs to decide or act — nothing more.
  Background rationale, how-I-got-there narration, and verification detail
  stay out (available on request); state the conclusion, not the journey.
- Never omit decision-relevant facts: verification status (verified /
  assumed / skipped), destructive-action consequences, or data that exists
  nowhere else. Everything else is droppable.
- Ask at most one question needing thought per turn. Up to 3 independent
  yes/no decisions may batch as a numbered list answerable positionally
  ("1 yes 2 no"). Destructive or irreversible decisions surface immediately
  with full blast-radius context — never deferred, never capped.
- Overflow and non-urgent decisions go on the engine's native task list
  (Claude: TodoWrite; Codex: update_plan) as their own items, each with
  the deciding context baked in — never buried in prose. Chat mentions the
  list only at the moment it changes (item added, resolved, or dropped —
  one line each); otherwise silent. Answer what's-left questions from the
  list, surface items one at a time when their turn comes, and before
  finishing a piece of work resolve or drop every open item with a reason.
- State line (done / next / blocked-on) at session start or resume, after
  multi-step runs, and when blocked on a decision — not on ordinary replies.
- The final message of a turn stands alone: relay subagent findings and
  mid-turn results in it — never reference them by a label the user
  hasn't seen.
- Illustrative or example lists cap at 5 items. Lists that are the
  deliverable (findings, decision lists, test results, changed files) stay
  complete — one line per item, worst-first.
