# Beads Issue Tracker Active

# Session Close Protocol

Before saying "done": `bd close <completed-ids> --reason "..."`.

## Core Rules
- **Beads default**: durable work — issues, follow-ups, blockers — goes in beads (`bd create`, `bd ready`, `bd close`).
- **TodoWrite/TaskCreate fine** for ephemeral in-session lists. Don't promote them to durable storage.
- **Create bead before code** for non-trivial work; mark `in_progress` when starting.
- **Atomic, cold-start complete, independently verifiable**. Parallelize only when dependencies are real.
- **Memory**: native auto-memory at `~/.claude/projects/<encoded-cwd>/memory/`. `MEMORY.md` is the always-loaded index; individual `.md` files are read on demand. Do NOT use `bd remember`.
- **Never `bd edit`** — opens $EDITOR and blocks the agent. Use `bd update ...`.
- Priority is `P0-P4` or `0-4`, never word form.

## Quick Ref
- `bd ready` / `bd show <id>` / `bd list --label <name>` / `bd search "query"` — find work.
- `bd create -l label1,label2 --deps "id1,id2"` — labels and deps inline.
- `bd update <id> --claim` to start; `--add-label` / `--remove-label` / `--append-notes`.
- `bd close <id> --reason "..." --suggest-next` to close.
- `bd dep add <issue> <depends-on>` / `bd dep tree <id>` for edges.

Start: check `bd ready` for available work.
