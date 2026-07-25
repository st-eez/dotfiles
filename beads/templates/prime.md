# Beads Issue Tracker Active

Beads is the task tracker, at two tiers. Durable work — follow-ups,
discovered issues, deferred scope, blockers, anything dispatched to
another agent — is a permanent bead. Ordinary in-session execution
steps stay in the worker's native todo list — do not mirror them into
Beads. Create an ephemeral bead (`bd create --ephemeral`, "wisp") only
when temporary subwork must be visible or recoverable outside the
worker's session: another worker or the coordinator gates on it, waits
on it, or must resume it after a crash or handoff. Close wisps as the
work completes; promote one with `bd promote <wisp-id>` if it outlives
the session or becomes a durable follow-up. Do not keep separate
markdown TODO lists. Before saying "done",
`bd close <ids> --reason "..."` with
what shipped and what was discovered; `bd update <id> --claim` when
picking a bead up. Honor the repo's beads policy for lifecycle rules.
Parked beads are legitimate: a scheduled triage session sweeps every
backlog and owns stale-bead decisions — never close, resurrect, or
nag about beads you aren't working on.

Sharp edges:
- Never `bd edit` — it blocks on $EDITOR; use `bd update`.
- Never `bd remember` — beads tracks issues, not knowledge; route
  memory per CLAUDE.md/AGENTS.md and agent-native memory.
- Priority is `P0-P4` or `0-4`, never word form.
- One `bd create` per shell command, never batched in a heredoc.
  Create parents before `--parent`/`--deps` children; run independent
  creates in parallel. `bd dep add` only for real dependencies.

Every bead is pickup-ready for someone with zero session context:
atomic (title names one verifiable outcome, not an area; independently
shippable steps are separate beads) and self-contained — current state
with `file:line` refs, concrete desired state, the why, a runnable
acceptance check, and known unknowns surfaced rather than hidden.

Quick ref: `bd ready` / `bd show <id>` / `bd search "q"` /
`bd list --label <l>` to find work; `bd create -l a,b --deps "x,y"`
(`--ephemeral` for wisps, `bd promote` to upgrade);
`bd close <id> --reason "..." --suggest-next`; `bd dep add|tree`;
`bd <subcommand> --help` for the rest.
