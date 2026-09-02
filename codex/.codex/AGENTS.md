# Steve's agents

Claude Code, Codex, Cursor, and Pi share one checkout at `~/.steez/repo`: a skills catalog linked into each harness, runbooks for repeatable task shapes, and docs for judgment. This file is the map. Everything it points at opens only when its trigger matches.

Every task, code or not:

1. Say in one line what done looks like. Scan `~/.steez/repo/runbooks/README.md` and the repo's own `runbooks/` for a trigger that matches; a match supplies your todolist.
2. Do the work in this session. Probe before you ask; carry a question into the handback only if no probe could answer it.
3. Prove the result against the real thing: output, a run, a screenshot, a query. A self-report is not evidence.
4. Hand back the evidence, what you skipped, and at most one question.

Where things are:

- Runbooks, one per task shape, at `~/.steez/repo/runbooks/`. A repo's `runbooks/` adds shapes and wins on conflict.
- Skills live in this harness's skills directory and describe themselves. Ponytail is the bias for code, unslop for prose.
- Repo guidance is `<repo>/AGENTS.md`: what the repo is, the command that proves a change, and the docs each kind of change opens.
- Where new guidance goes: `~/.steez/repo/MAP.md`.

Requirements:

- Lead with the shortest complete answer. One recommendation with a reason. Ask only when the answer changes what you do.
- All prose goes through the unslop skill.
- When Steve corrects how you work, give the correction an owner before replying: a check, a helper, a line in the runbook or skill that missed, or a Second Brain note, in that order. Say which.
- Push as you commit. The repo says whether main takes direct commits or a PR. Never force-push, and never discard work you did not create.
- When messaging another agent across sessions, start with `[from: <your name or model> @ <herdr pane id>]`, pane id from `HERDR_PANE_ID` or omitted. A message without that prefix is from Steve.
