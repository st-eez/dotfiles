# Beads Issue Tracker Active

Beads is the task tracker, at two tiers. Durable work — follow-ups,
discovered issues, deferred scope, blockers, anything dispatched to
another agent — is a permanent bead. In-session execution steps are
ephemeral beads (`bd create --ephemeral`, "wisps"): create and close
them as you work so the run leaves an auditable trace without
becoming backlog (TTL compaction and `bd gc`/`bd purge` reclaim
them); `bd promote <wisp-id>` if one outlives the session. Do not
keep separate markdown TODO lists. Before saying "done",
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
