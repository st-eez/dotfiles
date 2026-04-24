# Beads Issue Tracker Active

# Session Close Protocol

Before saying "done": `bd close <completed-ids> --reason "..."`.

## Core Rules
- **Beads default**: durable work — issues, follow-ups, blockers — goes in beads (`bd create`, `bd ready`, `bd close`).
- **TodoWrite/TaskCreate fine** for ephemeral in-session lists. Don't promote them to durable storage.
- **Create bead before code** for non-trivial work; mark `in_progress` when starting.
- **Memory**: use agent-native memory. **Never `bd remember`** — beads is for issue tracking, not knowledge.
- **Never `bd edit`** — opens $EDITOR and blocks the agent. Use `bd update ...`.
- Priority is `P0-P4` or `0-4`, never word form.

## Creating Beads — Atomic & Self-Contained

Every bead must be pickup-ready for a junior engineer who has only this bead's contents. No session context, no chat history, no "ask Steve".

**Atomic** — one outcome, one verifiable check.
- Title names the outcome, not the area. Bad: "Fix auth". Good: "Rotate JWT signing secret via KMS in `auth/session.ts`".
- If the work splits into independently shippable steps, it's two beads.

**Self-contained** — the bead answers these on its own:
1. **Context** — what exists today, in one or two sentences. Link the file(s) or symbol(s): `src/foo.ts:42`.
2. **Desired state** — what should exist after the work. Concrete, not "make it better".
3. **Why** — the constraint or motivation. If unclear, the bead is premature.
4. **Acceptance** — how to verify. A test name, a command, a user-visible behavior. Not "looks right".
5. **Known unknowns** — assumptions made, questions the implementer may hit. Better to surface than hide.

**Pre-create checklist** — before `bd create`, answer each out loud:
- [ ] Could a stranger with repo access start this tomorrow with zero other context?
- [ ] Is there exactly one outcome, or am I bundling?
- [ ] Did I name the file/function/symbol instead of the general area?
- [ ] Is acceptance something the implementer can run or observe, not a feeling?

Parallelize only when dependencies are real — `bd dep add` when they're not.

### Good vs bad

**Bad:** "Improve error handling in API layer."

**Good:**
> **Title:** Return 409 (not 500) when `POST /users` conflicts on email
>
> **Context:** `routes/users.ts:handleCreate` currently lets the unique-constraint violation bubble up as an uncaught error → 500.
>
> **Desired:** Catch `UniqueViolation` on `email` column, respond `409` with `{error: "email_taken"}`.
>
> **Why:** Frontend treats 5xx as retryable; we're getting duplicate submits in Sentry.
>
> **Acceptance:** `tests/users.create.test.ts::conflict_email` passes. Manual: `curl` twice with same email returns 201 then 409.
>
> **Unknowns:** Postgres driver error code is `23505`; confirm exposed on the error object before catching.

## Quick Ref
- `bd ready` / `bd show <id>` / `bd list --label <name>` / `bd search "query"` — find work.
- `bd create -l label1,label2 --deps "id1,id2"` — labels and deps inline.
- `bd update <id> --claim` to start; `--add-label` / `--remove-label` / `--append-notes`.
- `bd close <id> --reason "..." --suggest-next` to close.
- `bd dep add <issue> <depends-on>` / `bd dep tree <id>` for edges.

Start: check `bd ready` for available work.
