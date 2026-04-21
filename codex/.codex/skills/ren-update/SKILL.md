---
name: ren-update
description: |
  Eval-gated workflow for permanent changes to Ren's behavior or voice. Invoke when the user says `/ren-update`, asks to change `ren.md` or `soul.md`, wants to "make Ren better", or asks for a durable fix to Ren's prompt-stack behavior instead of an in-session promise.

  Choose the smallest durable layer: `ren.md` for always-on reflexes, `soul.md` for voice, hooks for runtime gates, skills for procedures, evals for regression coverage, and specs for descriptive updates after shipped behavior changes.
---

# /ren-update

Use this skill for durable changes to Ren itself, not for ordinary code changes in other repos.

## Scope

- Primary targets are `ren.md` and `soul.md` in the Ren repo.
- If the durable fix belongs in a hook, skill, eval, or spec instead of prompt text, change the smallest correct artifact.
- Do not turn every behavior complaint into more prompt text. Prompt budget is real.

## Repo Check

Resolve the Ren repo root first:

```sh
REN_REPO="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || pwd)"
```

Continue only if all of these exist:

- `"$REN_REPO/ren.md"`
- `"$REN_REPO/soul.md"`
- `"$REN_REPO/PRINCIPLES.md"`
- `"$REN_REPO/evals/run.py"`

If not, stop and tell the user to run `/ren-update` from the Ren repo.

## Workflow

1. Create or claim a bead before the first edit. Add the current worktree label.
2. Read only the minimum relevant files: the suspected target (`ren.md`, `soul.md`, hook, or skill), `PRINCIPLES.md`, and the smallest relevant spec and eval files.
3. Decide the right layer before editing:
   - `ren.md` = always-on reflexes
   - `soul.md` = voice
   - hooks = runtime gates
   - skills = repeatable procedures
   - evals = regression coverage
   - specs = descriptive updates after behavior changes land
4. Pick the eval subset before editing.
   - Reuse existing cases when they already cover the behavior.
   - Add one targeted case if coverage is missing.
   - Add one or two smoke cases that would catch likely regressions.
5. Run a baseline on the exact subset you plan to rerun after the patch.
6. Patch the smallest artifact that could plausibly fix the behavior.
7. Rerun the same eval subset. Do not switch cases mid-experiment unless the first set is invalid.
8. If baseline already passed and the patch only adds words, trim it back. Guardrail evals are still useful even when the patch does not improve scores.
9. Update the relevant spec in the same change when shipped behavior changes.
10. Report baseline vs after honestly. Do not claim improvement without evidence.

## Eval Shape

Use the existing harness:

```sh
python3 "$REN_REPO/evals/run.py" --case <case_id>
```

Good default shape:

- 1 targeted case for the requested behavior
- 1 voice or conciseness smoke case
- 1 adjacent regression case only if the change could plausibly affect routing, judgment, or tool choice

Prefer a tiny subset over the full suite unless the change is broad enough to justify it.

## Decision Rules

- If the user wants a permanent change to Ren, `/ren-update` is the right path.
- If the durable fix is procedural, prefer a skill over growing `ren.md`.
- If the durable fix can be enforced mechanically, prefer a hook, eval, or check over another reminder in prompt text.
- If the request is really about voice, inspect `soul.md` before touching `ren.md`.
- If the request is temporary or task-local, do not route to `/ren-update`.

## Finish

- Summarize what changed, which evals you ran, and whether the change actually improved anything.
- If the worktree already has unrelated dirty files, do not overwrite or revert them.
