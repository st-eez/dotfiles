## Beads Issue Tracker

This repo uses **bd (beads)** for durable work tracking. Run `bd prime` for the full rules, session close protocol, and bead-creation rubric.

### What goes where
- **Durable work** (issues, follow-ups, blockers, anything outlasting the session) → `bd create`.
- **Ephemeral in-session lists** (plans, transient todos) → TodoWrite/TaskCreate. Do **not** promote these to beads.
- **Memory** → native auto-memory at `~/.claude/projects/<encoded-cwd>/memory/`. **Do NOT use `bd remember`.**

### Hard rules
- **Never `bd edit`** — opens `$EDITOR` and blocks the agent. Use `bd update ...` / `bd note ...` / `bd comment ...`.
- Priority is `P0-P4` or `0-4`, never the word form.
- Every bead must be **atomic and self-contained**: a stranger with repo access should be able to start it tomorrow with zero other context. Title names the outcome, not the area. Include context, desired state, why, acceptance criteria, and known unknowns. Full rubric + example in `bd prime`.

### Quick reference
```bash
bd ready                               # Find available work
bd show <id>                           # View issue details
bd update <id> --claim                 # Claim work
bd create -l label1,label2 --deps id1  # Create with labels + deps
bd close <id> --reason "..."           # Close with reason
```

Before saying "done": `bd close <completed-ids> --reason "..."`.
