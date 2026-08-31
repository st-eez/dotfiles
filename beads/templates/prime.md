# Beads Issue Tracker Active

Beads tracks durable, coordination-relevant work. Create a permanent bead only
when work must outlive the session or cross an actor boundary: follow-ups,
discovered issues, deferred scope, blockers, and dispatched or delegated work.
Ordinary execution steps stay in the worker's native todo list; do not mirror
micro-tasks into Beads. This workflow does not use wisps or ephemeral beads.
Do not keep separate markdown TODO lists for durable work.

Before closing a bead, satisfy its acceptance criteria, run the relevant quality
gates, and attach concrete evidence. Clean git state is required only when the
acceptance itself is a commit or merge. Only the actor who owns final acceptance
closes a permanent bead; a delegated worker hands it back with evidence. Use
`bd update <id> --claim` when picking work up. Parked beads are legitimate: a
scheduled triage session owns stale-bead decisions — never close, resurrect, or
nag about beads you are not working on.

Fields:
- description: the outcome and why
- acceptance: a runnable, checkable done-when; without it the bead is not ready
  to dispatch
- design: non-obvious approach or constraints
- notes/comments: context, links, findings, and completion evidence

Human decisions: when only Steve can decide, record the exact decision with
`bd human`; do not guess or bury it in notes.

Sessions: project hooks normally load this context. Run `bd prime` manually only
when it appears stale after compaction or session replacement, or you are unsure
the rules loaded.

History authority: follow the repository's Dolt sync policy. Never push,
overwrite, or discard Beads history or repository history unless the active
instructions grant that authority.

Sharp edges:
- Never `bd edit` — it blocks on $EDITOR; use `bd update`.
- Never `bd remember` — Beads tracks work, not knowledge; route memory per
  CLAUDE.md/AGENTS.md and agent-native memory.
- Priority is `P0-P4` or `0-4`, never word form.
- Default to `--brief` on `bd ready`/`bd list` and `--brief-deps` on `bd show`;
  they cut output roughly 90%. Fetch full text only for the bead being worked.
- One `bd create` per shell command, never batched in a heredoc. Create parents
  before `--parent`/`--deps` children; run independent creates in parallel.
  Use `bd dep add` only for real dependencies.

Every bead is pickup-ready for someone with zero session context: atomic (one
verifiable outcome) and self-contained, with current `file:line` references,
the desired state, why it matters, a runnable acceptance check, and known
unknowns surfaced rather than hidden.

Quick ref: `bd ready --brief` / `bd show <id> --brief-deps` / `bd search "q"` /
`bd list --label <l>` / `bd create --acceptance "check" --design "constraints"` /
`bd update <id> --claim` / `bd close <id> --reason "..." --suggest-next` /
`bd dep add|tree` / `bd human` / `bd <subcommand> --help`.
