# steez

Your AI agent is only as good as the instructions you give it. steez turns Claude Code into a 21-specialist engineering team — planners, reviewers, testers, security auditors, and a release engineer — all living in your dotfiles, deployed with a single `stow` command, zero external dependencies.

Forked from [gstack](https://github.com/garrytan/gstack) (v0.13.0.0), stripped to the studs, and rebuilt for a solo operator who wants the full sprint pipeline without the team overhead.

## See it work

```
You:    I want to add OAuth login to my side project.
You:    /steez-office-hours

Claude: Before we build anything — who is logging in, and what
        are they protecting? You said "OAuth" but let me push
        back on the framing...
        [six forcing questions about the real problem]
        [writes design doc → saved to ~/.steez/projects/]

You:    /steez-plan-ceo-review
        [reads design doc, challenges scope, rates 10 dimensions]
        "Hold scope. OAuth is the right call, but drop the admin
        dashboard from v1 — ship login first, learn from usage."

You:    /steez-plan-eng-review
        [ASCII diagrams for auth flow, token refresh, error paths]
        [test matrix, security concerns, edge cases]

You:    Approve plan. Build it.
        [writes 1,800 lines across 9 files]

You:    /steez-review
        [AUTO-FIXED] 1 issue. [ASK] Token expiry edge case → you approve fix.

You:    /steez-qa https://localhost:3000
        [opens real browser, tests login flow, finds redirect bug, fixes it]

You:    /steez-ship
        Tests: 28 → 34 (+6 new). PR: github.com/you/app/pull/17
```

You said "OAuth login." The agent said "who is logging in and what are they protecting?" — because it listened to the pain, not the feature request. Six commands, design doc to merged PR. Every skill reads what the previous one wrote — the design doc, the test plan, the review log — so nothing falls through the cracks.

## The sprint

steez is a process, not a toolbox. The skills run in the order a sprint runs:

**Think → Plan → Build → Review → Test → Ship → Reflect**

Each skill feeds into the next. `/steez-office-hours` writes a design doc that `/steez-plan-ceo-review` reads. `/steez-plan-eng-review` writes a test plan that `/steez-qa` picks up. `/steez-review` catches bugs that `/steez-ship` verifies are fixed. Nothing falls through the cracks because every step knows what came before it.

| Skill | Your specialist | What they do |
|-------|----------------|--------------|
| `/steez-office-hours` | **Product Strategist** | Start here. Six forcing questions that reframe the problem before you write code. Two modes: Startup (diagnostic) and Builder (brainstorm). Writes a design doc that feeds every downstream skill. |
| `/steez-plan-ceo-review` | **CEO / Founder** | Rethink the problem. Find the 10-star product hiding inside the request. Four modes: Expansion, Selective Expansion, Hold Scope, Reduction. |
| `/steez-plan-eng-review` | **Eng Manager** | Lock in architecture, data flow, edge cases, test coverage. ASCII diagrams. Forces hidden assumptions into the open. |
| `/steez-plan-design-review` | **Senior Designer** | Rates each design dimension 0-10, explains what a 10 looks like, then edits the plan to get there. AI slop detection. |
| `/steez-design-consultation` | **Design Partner** | Build a complete design system from scratch. Researches the landscape, proposes creative risks, generates realistic mockups. Writes `DESIGN.md`. |
| `/steez-design-shotgun` | **Design Explorer** | Generate multiple AI design variants, open a comparison board, iterate until you approve a direction. Taste memory biases toward your preferences. |
| `/steez-review` | **Staff Engineer** | Pre-landing PR review. SQL safety, LLM trust boundaries, conditional side effects, completeness gaps. Auto-fixes the obvious ones. |
| `/steez-investigate` | **Debugger** | Systematic root-cause debugging. Iron Law: no fixes without investigation. Traces data flow, tests hypotheses, stops after 3 failed fixes. |
| `/steez-design-review` | **Designer Who Codes** | Visual audit — spacing, hierarchy, AI slop patterns — then fixes what it finds. Atomic commits, before/after screenshots. |
| `/steez-qa` | **QA Lead** | Test your app in a real browser, find bugs, fix them with atomic commits, re-verify. Generates regression tests for every fix. |
| `/steez-qa-only` | **QA Reporter** | Same methodology as `/steez-qa` but report only. Pure bug report, no code changes. |
| `/steez-cso` | **Chief Security Officer** | OWASP Top 10 + STRIDE threat model. Zero-noise: confidence gate, independent verification. Concrete exploit scenarios. |
| `/steez-ship` | **Release Engineer** | Sync base branch, run tests, audit coverage, push, open PR. Review Readiness Dashboard shows which reviews have run. |
| `/steez-land-and-deploy` | **Release Engineer** | Merge the PR, wait for CI and deploy, verify production health via canary checks. One command from "approved" to "verified in production." |
| `/steez-canary` | **SRE** | Post-deploy monitoring. Watches for console errors, performance regressions, and page failures using the browse daemon. |
| `/steez-document-release` | **Technical Writer** | Update all project docs to match what shipped. Reads every doc, cross-references the diff, catches stale READMEs automatically. |
| `/steez-retro` | **Eng Manager** | Weekly retro. Per-person breakdowns, shipping streaks, test health trends, growth opportunities. |
| `/steez-browse` | **QA Engineer** | Headless browser (Playwright + Chromium). Real clicks, real screenshots, ~100ms per command. Persistent sessions — log in once, stay logged in. |
| `/steez-autoplan` | **Review Pipeline** | One command, fully reviewed plan. Runs CEO → design → eng review automatically with encoded decision principles. Surfaces only taste decisions for your approval. |
| `/steez-codex` | **Second Opinion** | Independent review from OpenAI Codex CLI. Three modes: code review (pass/fail gate), adversarial challenge, and open consultation. Cross-model analysis when both `/steez-review` and `/steez-codex` have run. |
| `/steez-setup-deploy` | **Deploy Configurator** | One-time setup for `/steez-land-and-deploy`. Detects your platform, production URL, and deploy commands. |

### Helper scripts

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
  browse/                   # browse daemon state
    auth.json               # NS credentials (chmod 600, slot-keyed for multi-agent)
    locks/                  # account lock files (auto-managed, PID + 2h TTL)
    chromium-profile/       # persistent browser profile
```

## Philosophy

See [ETHOS.md](ETHOS.md) — two principles shape every skill:

1. **Boil the Lake** — always do the complete thing when AI makes the marginal cost near-zero
2. **Search Before Building** — three layers of knowledge (tried-and-true, new-and-popular, first-principles)

## Provenance

Forked from [gstack](https://github.com/garrytan/gstack) v0.13.0.0 on 2026-03-29. See [FORK_MANIFEST.md](FORK_MANIFEST.md) for per-file upstream mapping.

### What was stripped

~117 lines per skill (~8.4% average reduction):
- Onboarding conditionals — dead code for a single user
- Remote telemetry (Supabase sync) — no phone-home
- Contributor Mode → Skill Self-Report (always on, `~/.steez/skill-reports/`)
- Repo Ownership guidance — hardcoded solo mode
- Version update checks — steez is git-backed, not self-updating

### What was kept

All behavioral sections: Voice, AskUserQuestion format, Completeness Principle, Search Before Building, Completion Status Protocol, Eureka logging, all functional phases. Full workflow parity with gstack originals.

### What was changed

- Voice: "senior engineering partner — CTO-level operator" (not Garry Tan / GStack identity)
- Data: `~/.steez/` (not `~/.gstack/`)
- Binaries: `$STEEZ_BIN/steez-*` (not `~/.claude/skills/gstack/bin/gstack-*`)
- Chaining: all `/steez-*` (not `/gstack-*`)
- Config: `~/.steez/config` (not `~/.gstack/config.yaml`)

## Install

Already installed if you're reading this — steez lives in dotfiles and deploys via stow:

```bash
stow --dir="$HOME/Projects/Personal/dotfiles" --target="$HOME" --restow claude
```

The `claude` package uses folding, so `~/.claude/skills/steez/` is a symlink back to the repo. New skills created here land directly in dotfiles.

## Docs

| Doc | What it covers |
|-----|---------------|
| [Architecture](ARCHITECTURE.md) | Design decisions, "why" for every major choice, system internals |
| [Builder Ethos](ETHOS.md) | Boil the Lake, Search Before Building, three layers of knowledge |
| [Fork Manifest](FORK_MANIFEST.md) | Per-file upstream mapping, patches applied |
