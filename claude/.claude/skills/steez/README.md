# steez

Personal AI workflow skills, forked from [gstack](https://github.com/garrytan/gstack) (v0.13.0.0) and tailored for solo use. Lives in dotfiles, deployed via stow.

## What this is

Five workflow skills that form a sprint pipeline, plus a headless browser binary:

```
Think          Plan              Plan            Review       Ship
/steez-        /steez-plan-      /steez-plan-    /steez-      /steez-
office-hours → ceo-review      → eng-review    → review    → ship
               (scope & strategy) (architecture)  (PR audit)   (test, PR, push)
```

Each skill feeds into the next. `/steez-office-hours` writes a design doc that `/steez-plan-ceo-review` reads. `/steez-plan-eng-review` writes a test plan that `/steez-review` picks up. `/steez-ship` renders a Review Readiness Dashboard showing which reviews have run.

## Skills

| Skill | What it does |
|-------|-------------|
| `/steez-office-hours` | Start here. Six forcing questions that reframe the product before code is written. Produces a design doc. Two modes: Startup (diagnostic) and Builder (brainstorm). |
| `/steez-plan-ceo-review` | Rethink the problem. Four modes: scope expansion, selective expansion, hold scope, scope reduction. Reads the design doc. |
| `/steez-plan-eng-review` | Lock in architecture, data flow, edge cases, test coverage. ASCII diagrams. Reads the design doc. |
| `/steez-review` | Pre-landing PR review. Analyzes diff for SQL safety, LLM trust boundary violations, conditional side effects, completeness gaps. Auto-fixes obvious issues. |
| `/steez-ship` | Sync base branch, run tests, audit coverage, push, open PR. Review Readiness Dashboard. |
| `/steez-browse` | Headless browser (Playwright + Chromium). Merging gstack-browse + playwright-cli + NetSuite commands into a single binary. WIP. |

## Helper scripts

Five bash scripts in `steez/bin/` that skills call at runtime:

| Script | Purpose |
|--------|---------|
| `steez-config` | Read/write `~/.steez/config` (YAML key-value) |
| `steez-slug` | Extract `owner-repo` slug from git remote (with non-git fallback) |
| `steez-review-log` | Append JSON review entries to `~/.steez/projects/$SLUG/` |
| `steez-review-read` | Read review log + config for Review Readiness Dashboard |
| `steez-diff-scope` | Categorize diff as frontend/backend/prompts/tests/docs/config |

## Runtime state

Skills write session data and analytics to `~/.steez/` (not in dotfiles):

```
~/.steez/
  config                    # proactive: true
  sessions/                 # active session tracking (auto-cleaned after 2h)
  analytics/
    skill-usage.jsonl       # local usage log (every skill invocation)
    eureka.jsonl            # first-principles insights (Search Before Building)
  skill-reports/            # Skill Self-Report bug reports (always on)
    {slug}.md
  projects/
    {slug}/
      *-design-*.md         # design docs from /steez-office-hours
      *-reviews.jsonl       # review logs from /steez-review, /steez-ship
  browse/                   # browse daemon state (chromium profile, sessions)
```

## Philosophy

See [ETHOS.md](ETHOS.md) — two principles shape every skill:

1. **Boil the Lake** — always do the complete thing when AI makes the marginal cost near-zero
2. **Search Before Building** — three layers of knowledge (tried-and-true, new-and-popular, first-principles)

## Provenance

Forked from gstack v0.13.0.0 on 2026-03-29. See [FORK_MANIFEST.md](FORK_MANIFEST.md) for per-file upstream mapping and patches applied.

### What was stripped

~117 lines per skill (~8.4% average reduction):
- Onboarding conditionals (LAKE_INTRO, TEL_PROMPTED, PROACTIVE_PROMPTED) — dead code
- Remote telemetry (Supabase sync) — no phone-home
- Contributor Mode — repurposed as Skill Self-Report (always on, writes to `~/.steez/skill-reports/`)
- Repo Ownership guidance — hardcoded solo mode
- Version update checks — steez is git-backed, not self-updating
- skill_prefix config — steez skills are always `/steez-*`

### What was kept

All behavioral sections: Voice, AskUserQuestion format, Completeness Principle, Search Before Building, Completion Status Protocol, Eureka logging, all functional phases. Full workflow parity with gstack originals.

### What was changed

- Voice identity: "senior engineering partner — CTO-level operator" (was Garry Tan/GStack identity)
- Data directory: `~/.steez/` (was `~/.gstack/`)
- Binary paths: `$STEEZ_BIN/steez-*` (was `~/.claude/skills/gstack/bin/gstack-*`)
- Skill chaining: all `/steez-*` (was `/gstack-*`)
- Config file: `~/.steez/config` (was `~/.gstack/config.yaml`)

## Install

Already installed if you're reading this — steez lives in dotfiles and deploys via stow:

```bash
stow --dir="$HOME/Projects/Personal/dotfiles" --target="$HOME" --restow claude
```

The `claude` package uses folding, so `~/.claude/skills/steez/` is a symlink back to the repo. New skills created here land directly in dotfiles.
