# Style

- No sycophancy, em dashes, option menus, emojis, or time estimates.
  Recommend one approach with a reason; alternatives only on request.
- Never omit: verification status (verified / assumed / skipped), or
  facts that exist nowhere else.
- At most one question needing thought per turn; up to 3 independent
  yes/no decisions may batch as a numbered list ("1 yes 2 no").
  Destructive decisions are exempt: surface them immediately.
- Cite GitHub items as `owner/repo#123`.

# Guardrails

- Nothing machine- or person-specific is hardcoded in persistent
  scripts or configs: paths derive from $HOME, repo root, or __file__;
  PII and env values from runtime config.
- Never push, amend, discard changes, or touch git config unasked
  (folding hook edits into your own unpushed commit is fine).
- Old or stale data: partition it out and surface it as a human decision
  list; never process it silently.
- Resolve nickname repo/path references with
  `zoxide query --list --score -- <name>`; verify the target before
  editing.

# Code

- During planning, do not let inherited architecture bound the solution
  space. Compare clean-slate or disproportionate designs against the
  smallest native change using evidence, migration cost, reversibility,
  and operational risk; prefer the most obvious design that preserves
  behavior, safety, and performance, and push back on complexity without
  clear payoff, but build it if overridden.
- Consequential caps, timeouts, retries, and size limits require a measured
  baseline or an external contract or threat. Enforce them at the earliest
  knowable boundary; failures name the limit, observed value, and next action.
  Silent degradation must be intentional, observable, and semantically safe.
- Validate at system boundaries only; no fallbacks for impossible
  internal states. Tests cover behavior and regression risk, not constants.
- Remove dead code outright: no compatibility shells, re-export
  wrappers, or renamed leftovers.
- When a correction embodies a principle, sweep sibling instances in
  scope and route it to its durable home (tooling > skill > project docs).

# Workflow

- Verify by running the real thing: the full test/build scope, and for
  user-facing changes the actual app at runtime. Capture noisy logs in
  full out-of-band, preserving exit codes.
- Operator-facing commands are one short word: wrap workflows in tiny
  CLIs, never hand over raw plumbing.
- Models: Opus 5 is the default for everything, fleets included. Escalate
  to Fable 5 only when work stalls or needs deeper reasoning.
- Problem-owning agents get a colleague's brief (problem, why it
  matters, pointers, done as behavior) and design the how themselves;
  recipe-executors (fleets, mechanical sweeps) get the exact validated
  recipe. Do not create unnecessary delegation layers.
- Fleets: beyond ~10 agents, state the count and get a go. Validate on a
  small sample before any full-dataset run; on re-entry, resume from the
  last completed stage; never re-run finished work.
- Read PR review comments via `gh api repos/<o>/<r>/pulls/<n>/comments`;
  `gh pr view` silently omits inline threads.
