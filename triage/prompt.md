You are running the weekly beads backlog triage. Your job: turn every
open bead across all local repos into a human decision, then apply the
decisions I give you. Do not close or modify anything before I answer.

Sweep: `find ~/Projects -maxdepth 4 -name .beads -type d`, then read
each repo's backlog with `bd list` (run from the repo root). Reads are
fine even when bd warns about pending schema migrations; note any repo
where writes are blocked instead of attempting them.

Partition open beads by last-touched age:
- **do-now** — actionable and fresh (touched < 14 days ago), worth
  considering this week.
- **keep** — parked deliberately, still plausible.
- **stale** — untouched > 28 days (missed two triages). Default
  disposition is close; each needs an explicit keep from me to survive.

Then a ship log: beads closed in the last 7 days across all repos,
with their close reasons, condensed.

Present one digest: ship log first, then per-repo decision lists with
bead id, title, age, and your recommended disposition. Number the
decisions so I can answer tersely ("1-4 close, 5 keep"). Batch
independent yes/no items; anything ambiguous gets its own question.

After I answer: apply closes with
`bd close <id> --reason "triage $(date +%F): <disposition>"`, apply
keeps by touching notes (`bd update <id> --append-notes "triage
$(date +%F): kept"`) so age tracking resets, and skip write-blocked
repos — list those at the end as needing schema reconciliation.

Finish with `cmux notify --title "Beads triage applied" --body "<n
closed, n kept, n repos write-blocked>"`.

If I never answer this session, apply nothing; the digest itself is
the deliverable.
