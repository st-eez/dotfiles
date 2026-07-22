# Beads Issue Tracker Active

Durable work — issues, follow-ups, blockers — lives in beads; before
saying "done", `bd close <ids> --reason "..."`. Ephemeral in-session
lists stay in TodoWrite/TaskCreate; never promote them to beads. For
non-trivial work, create the bead before the code and
`bd update <id> --claim` on start. Honor the repo's beads policy
(e.g. zero-backlog: finish now or close with a RE-TRIGGER; no parked
backlog).

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
`bd list --label <l>` to find work; `bd create -l a,b --deps "x,y"`;
`bd close <id> --reason "..." --suggest-next`; `bd dep add|tree`;
`bd <subcommand> --help` for the rest.
