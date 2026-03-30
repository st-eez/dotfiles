# Architecture

This document explains **why** steez is built the way it is. For the skill catalog and usage, see [README.md](README.md). For upstream provenance, see [FORK_MANIFEST.md](FORK_MANIFEST.md).

## The core idea

steez is 21 Markdown files that turn Claude Code into a structured engineering team. No build step, no runtime dependencies, no server — just SKILL.md files that Claude reads when you invoke a slash command.

The key insight: AI agents don't need frameworks, they need **opinionated instructions**. A well-written SKILL.md with clear phases, explicit voice, and filesystem-based data flow produces better results than a sophisticated template engine. steez proves this by running the same sprint pipeline as gstack — Think → Plan → Build → Review → Test → Ship → Reflect — with zero infrastructure beyond stow and git.

## Where everything lives

steez spans two locations: the dotfiles repo (git-backed, deployed via stow) and a runtime state directory (local-only, never committed).

### Repo (dotfiles)

```
dotfiles/claude/.claude/skills/
  steez/                              # shared home
    bin/                              # 5 helper scripts
    browse/                           # headless browser (Playwright + Chromium)
    ETHOS.md                          # builder philosophy
    FORK_MANIFEST.md                  # upstream provenance
    README.md                         # ecosystem docs
    ARCHITECTURE.md                   # this file
  steez-office-hours/SKILL.md         # ─┐
  steez-plan-ceo-review/SKILL.md      #  │
  steez-plan-eng-review/SKILL.md      #  │
  steez-plan-design-review/SKILL.md   #  │ 21 workflow skills
  steez-review/SKILL.md + checklists  #  │ each in its own directory
  steez-ship/SKILL.md                 #  │
  ...                                 # ─┘
```

### Runtime (`~/.steez/`)

```
~/.steez/
  config                              # key-value config (proactive: true)
  sessions/                           # PID-based session tracking
  analytics/
    skill-usage.jsonl                 # every skill invocation
    eureka.jsonl                      # first-principles insights
  skill-reports/                      # Skill Self-Report bug reports
  projects/{slug}/                    # per-project design docs + review logs
  browse/                             # chromium profile, sidebar sessions
    auth.json                         # NS credentials (chmod 600, slot-keyed)
    locks/                            # account lock files (PID + TTL)
```

### Stow deployment

The `claude` package uses directory folding. After `stow --restow claude`, `~/.claude/skills/` is a symlink to `dotfiles/claude/.claude/skills/`. This means:

- Editing files in the repo edits them live in `~/.claude/skills/`
- New skill directories created in the repo appear immediately
- `steez/bin/` scripts are accessible at `$HOME/.claude/skills/steez/bin/`

## Why no templates

gstack generates SKILL.md files from `.tmpl` templates via `gen-skill-docs.ts`. This makes sense for gstack — 29 skills with shared preambles and auto-generated command references from source code metadata. Template drift is a real risk at that scale.

steez doesn't use templates. Each SKILL.md is hand-edited directly.

**Why this works:**
- **No build step.** Edit a SKILL.md, it's live immediately. No `bun run gen:skill-docs`, no stale generated output.
- **21 skills is manageable.** The preamble pattern is ~30 lines. Updating 21 files manually takes 5 minutes with search-and-replace. At 50+ skills, this would break down.
- **No template/generated drift.** gstack's template system solves a real problem — but it introduces its own: the generated SKILL.md can be stale if someone forgets to regenerate. steez has no generated files to go stale.

**The tradeoff:** shared-section updates (preamble, voice, AskUserQuestion format) must be applied to all 21 files manually. This is acceptable friction for a single maintainer.

## Why hardcoded solo

gstack detects whether a repo is solo or collaborative based on contributor count and adapts behavior — review depth, PR format, communication style. steez hardcodes `REPO_MODE=solo` in every preamble.

**Why:** This is personal tooling deployed from dotfiles. There is no multi-user scenario. The detection logic is dead code, and dead code is a liability — it adds lines that Claude reads, costs tokens, and can confuse the agent about whether it should behave differently.

**How to apply:** Every skill preamble sets `REPO_MODE=solo` as a constant. No conditional branches, no contributor detection.

## Why local-only telemetry

gstack supports opt-in remote telemetry via Supabase — anonymous usage data (skill name, duration, success/fail) sent to a hosted database. steez strips all remote telemetry.

**Why:** steez runs in a public dotfiles repo. Embedding remote endpoints in committed files is a maintenance burden and a trust issue. Local analytics provide the same signal — which skills get used, how long they take, what fails — without any network dependency.

**How it works:** Every skill appends a JSON line to `~/.steez/analytics/skill-usage.jsonl` at session end. This is a local file, never synced. The eureka log (`eureka.jsonl`) captures first-principles insights from the Search Before Building pattern.

## Why no onboarding

gstack runs first-time prompts for three features: lake intro (philosophy), telemetry consent, and proactive skill suggestions. Each prompt sets a flag in config so it only fires once. steez strips all three.

**Why:** Single user, config pre-seeded. The onboarding conditionals are dead code — they check flags that are already set. Every line of SKILL.md costs tokens when Claude reads it. Dead conditionals waste tokens and add noise.

**How to apply:** `~/.steez/config` ships with `proactive: true` already set. No first-run detection needed.

## Why Skill Self-Report is always on

gstack has a "Contributor Mode" gated behind a `gstack_contributor` config flag. When enabled, the agent files casual bug reports when gstack itself misbehaves. steez repurposes this as "Skill Self-Report" and makes it unconditional.

**Why:** You're the maintainer. If a skill misbehaves, you want to know. Gating the report behind a flag that you'd always enable adds complexity for zero benefit. Reports go to `~/.steez/skill-reports/{slug}.md`.

## Skill anatomy

Every SKILL.md follows the same structure:

```
┌─ YAML frontmatter ─────────────────────────┐
│ name: steez-{skill}                        │
│ description: ...                           │
│ allowed-tools: [Bash, Read, ...]           │
└────────────────────────────────────────────┘
         │
┌─ Preamble (bash block, run first) ─────────┐
│ STEEZ_HOME, STEEZ_BIN, session tracking    │
│ Branch detection, config read              │
│ REPO_MODE=solo, local usage logging        │
└────────────────────────────────────────────┘
         │
┌─ Behavioral sections (shared pattern) ─────┐
│ PROACTIVE check, Voice identity            │
│ AskUserQuestion format                     │
│ Completeness Principle (Boil the Lake)     │
│ Search Before Building (→ ETHOS.md)        │
│ Skill Self-Report, Telemetry footer        │
│ STEEZ REVIEW REPORT                        │
└────────────────────────────────────────────┘
         │
┌─ Functional phases (skill-specific) ───────┐
│ Phase 1, Phase 2, Phase 3...              │
│ Skill chaining references                  │
└────────────────────────────────────────────┘
```

### Preamble variables

Every skill preamble sets these variables:

| Variable | Source | Purpose |
|----------|--------|---------|
| `STEEZ_HOME` | Hardcoded `$HOME/.steez` | Runtime state directory |
| `STEEZ_BIN` | Hardcoded `$HOME/.claude/skills/steez/bin` | Helper script directory |
| `_BRANCH` | `git branch --show-current` | Current branch |
| `_PROACTIVE` | `steez-config get proactive` | Auto-suggest skills |
| `REPO_MODE` | Hardcoded `solo` | Always solo |
| `_TEL_START` | `date +%s` | Session start time |
| `_SESSION_ID` | `$$-$(date +%s)` | Unique session identifier |

## Data flow

Skills communicate through the filesystem, not through shared memory:

```
/steez-office-hours
  writes → ~/.steez/projects/{slug}/{user}-{branch}-design-{ts}.md
           │
/steez-plan-ceo-review
  reads  ← design doc
  writes → review log entry (via steez-review-log)
           │
/steez-plan-eng-review
  reads  ← design doc + prior review logs
  writes → review log entry
           │
/steez-review
  reads  ← diff + review logs (via steez-review-read)
  writes → review log entry
           │
/steez-ship
  reads  ← review logs → renders Review Readiness Dashboard
  writes → final review log entry
  creates → PR
```

### Review Readiness Dashboard

`steez-review-read` outputs three sections that `/steez-ship` and `/steez-review` use:

```
{branch}-reviews.jsonl entries    ← review history
---CONFIG---
{skip_eng_review value}           ← config overrides
---HEAD---
{short commit hash}               ← current HEAD
```

### Helper script dependencies

```
steez-slug ← steez-review-log (needs SLUG for file path)
           ← steez-review-read (needs SLUG for file path)

steez-config ← steez-review-read (reads skip_eng_review)
             ← all skills (reads proactive in preamble)

steez-diff-scope — standalone, no dependencies
```

## Browse integration

Skills reference the browse binary as `$B`:

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
B=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/.claude/skills/steez/browse/dist/browse" ] && B="$_ROOT/.claude/skills/steez/browse/dist/browse"
[ -z "$B" ] && B=~/.claude/skills/steez/browse/dist/browse
```

Resolution order: repo-local binary first, global fallback second. This allows per-project browse versions while defaulting to the stowed version.

The browse binary is a compiled Bun daemon built on the Playwright npm library (v1.58.2). It provides a long-lived Chromium session with sub-second command latency. See the browse skill for architecture details.

### NetSuite authentication

NS commands (`$B ns login`, `$B ns navigate`, etc.) authenticate via `~/.steez/browse/auth.json` (chmod 600 required). The file uses slot-keyed accounts to support multiple users on the same sandbox:

```json
{
  "accounts": {
    "5582598-sb2:account2": {
      "email": "user+2@example.com",
      "password": "...",
      "accountId": "5582598-sb2",
      "securityQuestions": { "keyword": "answer" }
    },
    "5582598-sb2:account3": {
      "email": "user+3@example.com",
      "password": "...",
      "accountId": "5582598-sb2",
      "securityQuestions": { "keyword": "answer" }
    }
  }
}
```

**Slot keys** (e.g. `5582598-sb2:account2`) are the locking unit. The `accountId` field is the real NS account ID used for the login URL. When `accountId` is omitted, the slot key itself is used (backwards compatible with single-user setups where the key is just `5582598-sb2`).

**Security questions** use case-insensitive substring matching. Store keywords ("city", "nickname"), not full question text.

### Account locking

Parallel agents (e.g. A/B eval via tmux split) must not share the same NS user session. `$B ns login` manages this automatically via lock files at `~/.steez/browse/locks/<slot>.lock`.

```
$B ns login                              → picks first unlocked slot
$B ns login --account 5582598-sb2:account3 → claims specific slot
$B ns login --release                    → releases all locks held by this process
```

Lock lifecycle:
1. **Acquire:** atomic file write (`O_EXCL`) on login. Contains `{ pid, ts }`.
2. **Release:** automatic on browse shutdown (SIGTERM/SIGINT handler).
3. **Stale detection:** before honoring a lock, check if PID is alive (`kill -0`). Dead PID = stale lock, reclaimed immediately. Fallback: locks older than 2h TTL are ignored.

This means crashed sessions don't permanently block accounts. The next agent to check will find the dead PID and reclaim the slot.

## Error philosophy

Skill errors are for the AI agent, not for humans. Every error message should be actionable — tell Claude what went wrong and what to do next. This principle is inherited from gstack's browse server (which rewrites Playwright errors through `wrapError()`) and applied to skill design:

- If a config value is missing, the preamble falls back to a sensible default
- If a design doc isn't found, the skill tells the agent to run `/steez-office-hours` first
- If a review log is empty, the Review Readiness Dashboard says "no reviews found" instead of erroring

## What's intentionally not here

- **No template system.** 21 skills is manageable by hand. The build step complexity isn't justified. See "Why no templates" above.
- **No multi-user support.** `REPO_MODE=solo` is hardcoded. No contributor detection, no collaborative review workflows.
- **No remote telemetry.** All analytics are local JSONL files. No Supabase, no network calls.
- **No onboarding flow.** Config is pre-seeded. No first-run prompts, no opt-in gates.
- **No self-updater.** steez is git-backed. `git pull` in dotfiles is the update mechanism.
- **No shared command reference generation.** Unlike gstack's `{{COMMAND_REFERENCE}}` template placeholders, browse command docs are maintained directly in the browse SKILL.md.

## Key differences from gstack

| Aspect | gstack | steez |
|--------|--------|-------|
| Deployment | `git clone` + `./setup` | stow from dotfiles |
| Template system | `.tmpl` → `gen-skill-docs.ts` → `SKILL.md` | hand-edited SKILL.md |
| Config file | `~/.gstack/config.yaml` | `~/.steez/config` (no extension) |
| Repo mode | Detected per-repo | Hardcoded solo |
| Telemetry | Local JSONL + opt-in Supabase sync | Local JSONL only |
| Onboarding | First-run prompts | None (pre-seeded) |
| Contributor Mode | Gated behind flag | Skill Self-Report (always on) |
| Voice | Garry Tan / GStack identity | "Senior engineering partner — CTO-level operator" |
| Skill count | 29 skills | 21 skills |
| Update mechanism | `/gstack-upgrade` self-updater | `git pull` in dotfiles |

## Extending steez

### Adding a new skill

1. Create `dotfiles/claude/.claude/skills/steez-{name}/SKILL.md`
2. Copy the preamble from any existing skill (change `SKILL_NAME`)
3. Stow deploys it automatically (directory folding)

### Porting from gstack

1. `mkdir -p` the skill directory + `cp` source SKILL.md
2. YAML frontmatter `name:` → `steez-*`
3. Remove auto-generated comments (template artifact markers)
4. Replace preamble with steez pattern (`STEEZ_HOME`, `STEEZ_BIN`, curly-brace config fallback, `REPO_MODE=solo`, local JSONL)
5. Strip onboarding conditionals (`LAKE_INTRO`, `TEL_PROMPTED`, `PROACTIVE_PROMPTED`) — keep only the `PROACTIVE` check
6. Voice → "senior engineering partner — CTO-level operator"
7. Delete YC pitch line
8. Strip Repo Ownership section
9. Contributor Mode → Skill Self-Report (always on, `~/.steez/skill-reports/`)
10. Telemetry → local JSONL only (strip Supabase sync)
11. SETUP browse → steez pattern (`$_ROOT/.claude/skills/steez/browse/dist/browse`)
12. Plan Status Footer → `STEEZ REVIEW REPORT`
13. Global replace all gstack paths/refs → steez
14. Verify: `grep -c -i gstack SKILL.md` must return 0

**Gotcha:** bash `||` and `&&` precedence — use curly braces `{ }` for fallback grouping (e.g., `cmd || { fallback; }`).

### Updating from upstream

1. Check gstack version: `cat ~/.claude/skills/gstack/VERSION`
2. Diff per-skill: `diff ~/.claude/skills/gstack/{skill}/SKILL.md dotfiles/claude/.claude/skills/steez-{skill}/SKILL.md`
3. Cherry-pick functional changes (skip template/onboarding diffs)
4. Update FORK_MANIFEST.md with new upstream version
