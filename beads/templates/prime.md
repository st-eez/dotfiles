# Beads issue tracker active

Beads (`bd`) is the shared graph for work across agents and sessions. Create a
bead only for work another actor may need to own or resume: a handoff,
delegated outcome, blocker, discovered issue, or deferred scope. Keep your own
execution steps in your native todo list; do not mirror them into beads or
separate markdown TODO files. Do not use wisps or ephemeral beads.

If your assignment names a bead, use that ID. Use `bd ready` only when your
task is to choose backlog work. Before starting any bead, run `bd show <id>`,
then `bd update <id> --claim`.

Every bead must be pickup-ready with zero session context and one verifiable
outcome: the outcome and why, a runnable acceptance check, anything still
unknown, and relevant paths or symbols when code is involved. Create with
`bd create --title "..." --description "outcome and why" --acceptance
"runnable done-when"`; add `--design` for non-obvious constraints, `--parent`
for hierarchy, and `--deps` only when one bead cannot proceed until another
completes. One `bd create` per shell command, never a heredoc batch;
referenced parents and dependencies must exist first.

## Lifecycle

Before closing, satisfy acceptance and run the relevant quality gates. Attach
evidence with `bd comment <id> "..."`; the actor who completed the work closes
with `bd close <id> --reason "..."`. A dirty worktree does not block closure
unless acceptance requires a commit or merge. Acceptance responsibility comes
from the workflow that dispatched the work, not the bead's assignee field; if
acceptance later fails, that actor runs `bd reopen <id>` with a comment naming
the gap.

If you stop before completion, comment what is done, what remains, and any
blocker. Return available work with `bd update <id> -s open`; set `-s blocked`
only when it cannot proceed, adding the edge with
`bd dep add <id> <blocker-id>`. Do not change or follow up on unrelated beads.

When only Steve can decide, create a `human` bead stating the exact question,
known options, and blocking context (`bd create -l human ...`); do not guess
or bury the question in notes.

## Sharp edges

- Beads tracks work, not knowledge. Durable knowledge goes to Second Brain or
  agent-native memory; never `bd remember`.
- Never `bd edit`; it blocks on $EDITOR. Use `bd update`.
- Priority is `P0-P4` or `0-4`, never word form.
- Never push, overwrite, or discard Beads history unless active instructions
  grant that authority.
- Run `bd prime` only when this context is missing from your window.
- `bd --help` lists all commands.
