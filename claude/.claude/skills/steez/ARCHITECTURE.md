# Architecture

How steez is built, why it's built this way, and where everything lives.

## File structure

Steez spans two locations: the dotfiles repo (git-backed, deployed via stow) and a runtime state directory (local-only, never committed).

### Repo (dotfiles)

```
dotfiles/claude/.claude/skills/
  steez/                              # shared home
    bin/                              # 5 helper scripts
      steez-config                    # config read/write
      steez-slug                      # project slug from git remote
      steez-review-log                # append review entries
      steez-review-read               # read reviews + config
      steez-diff-scope                # categorize diff scope
    browse/                           # headless browser binary (WIP)
      src/                            # TypeScript source
      dist/                           # compiled Bun binary
      bin/find-browse                 # binary discovery shim
      SKILL.md                        # browse skill definition
    ETHOS.md                          # builder philosophy (Boil the Lake, Search Before Building)
    FORK_MANIFEST.md                  # upstream provenance tracking
    README.md                         # this ecosystem's docs
    ARCHITECTURE.md                   # this file
  steez-office-hours/SKILL.md         # workflow skill
  steez-plan-ceo-review/SKILL.md      # workflow skill
  steez-plan-eng-review/SKILL.md      # workflow skill
  steez-review/                       # workflow skill + supporting docs
    SKILL.md
    checklist.md                      # PR review checklist (read at runtime)
    design-checklist.md               # design review checklist
    TODOS-format.md                   # TODOS.md format spec
    greptile-triage.md                # greptile integration triage rules
  steez-ship/SKILL.md                 # workflow skill
```

### Runtime (`~/.steez/`)

```
~/.steez/
  config                              # key-value config (proactive: true)
  sessions/                           # PID-based session tracking
  analytics/
    skill-usage.jsonl                 # every skill invocation
    eureka.jsonl                      # first-principles insights
  skill-reports/
    {slug}.md                         # Skill Self-Report bug reports
  projects/
    {slug}/
      {user}-{branch}-design-{ts}.md  # design docs
      {branch}-reviews.jsonl          # review log entries
  browse/                             # chromium profile, sidebar sessions
```

### Stow deployment

The `claude` package uses directory folding. After `stow --restow claude`, `~/.claude/skills/` is a symlink to `dotfiles/claude/.claude/skills/`. This means:

- Editing files in the repo edits them live in `~/.claude/skills/`
- New skill directories created in the repo appear immediately
- `steez/bin/` scripts are accessible at `$HOME/.claude/skills/steez/bin/`

## Skill anatomy

Every SKILL.md follows the same structure:

```
┌─ YAML frontmatter ─────────────────────────┐
│ name: steez-{skill}                        │
│ preamble-tier: 3 or 4                      │
│ version: 1.0.0 or 2.0.0                   │
│ description: ...                           │
│ allowed-tools: [Bash, Read, ...]           │
└────────────────────────────────────────────┘
         │
┌─ Preamble (bash block, run first) ─────────┐
│ STEEZ_HOME="$HOME/.steez"                  │
│ STEEZ_BIN="$HOME/.claude/skills/steez/bin" │
│ Session tracking, branch detection          │
│ Config read (steez-config)                  │
│ REPO_MODE=solo (hardcoded)                  │
│ Local usage logging (JSONL)                 │
└────────────────────────────────────────────┘
         │
┌─ Behavioral sections (shared pattern) ─────┐
│ PROACTIVE check                            │
│ Voice identity                             │
│ AskUserQuestion format                     │
│ Completeness Principle (Boil the Lake)     │
│ Search Before Building (→ ETHOS.md)        │
│ Skill Self-Report                          │
│ Completion Status Protocol                 │
│ Telemetry footer (local JSONL only)        │
│ Plan Status Footer (STEEZ REVIEW REPORT)   │
│ SETUP browse check                         │
└────────────────────────────────────────────┘
         │
┌─ Functional phases (skill-specific) ───────┐
│ The actual workflow logic                  │
│ Phase 1, Phase 2, Phase 3...              │
│ Skill chaining: /steez-plan-ceo-review →   │
│   /steez-plan-eng-review → /steez-review   │
└────────────────────────────────────────────┘
```

### Preamble variables

Every skill preamble sets these variables that Claude uses throughout the session:

| Variable | Source | Purpose |
|----------|--------|---------|
| `STEEZ_HOME` | Hardcoded `$HOME/.steez` | Runtime state directory |
| `STEEZ_BIN` | Hardcoded `$HOME/.claude/skills/steez/bin` | Helper script directory |
| `_BRANCH` | `git branch --show-current` | Current branch (for AskUserQuestion grounding) |
| `_PROACTIVE` | `steez-config get proactive` | Whether to auto-suggest skills |
| `REPO_MODE` | Hardcoded `solo` | Always solo (no collaborative mode) |
| `_TEL_START` | `date +%s` | Session start time (for duration logging) |
| `_SESSION_ID` | `$$-$(date +%s)` | Unique session identifier |

### No template system

gstack generates SKILL.md files from `.tmpl` templates via `gen-skill-docs.ts`. Steez does not use templates. Each SKILL.md is hand-edited directly. This means:

- No build step required
- Changes to shared sections (preamble, voice) must be applied to all 5 files manually
- No risk of template/generated drift

## Data flow

### Skill chaining

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

`steez-review-read` outputs three sections that `/steez-ship` and `/steez-review` use to render the dashboard:

```
{branch}-reviews.jsonl entries    ← review history
---CONFIG---
{skip_eng_review value}           ← config overrides
---HEAD---
{short commit hash}               ← current HEAD
```

### Helper script dependency chain

```
steez-slug ← steez-review-log (needs SLUG for file path)
           ← steez-review-read (needs SLUG for file path)

steez-config ← steez-review-read (reads skip_eng_review)
             ← all skills (reads proactive in preamble)
```

`steez-diff-scope` is standalone — no dependencies on other scripts.

## Browse integration

Skills reference the browse binary as `$B`:

```bash
# SETUP block in every skill
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
B=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/.claude/skills/steez/browse/dist/browse" ] && B="$_ROOT/.claude/skills/steez/browse/dist/browse"
[ -z "$B" ] && B=~/.claude/skills/steez/browse/dist/browse
```

Resolution order: repo-local binary first, global fallback second. This allows per-project browse versions while defaulting to the stowed version.

The browse binary is a WIP project merging gstack-browse + playwright-cli + NetSuite automation into a single compiled Bun binary. See `steez/browse/` for source. Architecture details will live in browse-specific docs once the binary stabilizes.

## Key differences from gstack

| Aspect | gstack | steez |
|--------|--------|-------|
| Deployment | `git clone` + `./setup` | stow from dotfiles |
| Template system | `.tmpl` → `gen-skill-docs.ts` → `SKILL.md` | hand-edited SKILL.md |
| Config file | `~/.gstack/config.yaml` | `~/.steez/config` (no extension) |
| Repo mode | Detected per-repo (solo/collaborative) | Hardcoded solo |
| Telemetry | Local JSONL + opt-in Supabase sync | Local JSONL only |
| Onboarding | First-run prompts (lake intro, telemetry, proactive) | None (config pre-seeded) |
| Contributor Mode | Gated behind `_CONTRIB` flag | Repurposed as Skill Self-Report (always on) |
| Voice | Garry Tan / GStack identity | "Senior engineering partner — CTO-level operator" |
| Skill count | 28 skills | 6 skills (5 workflow + browse) |
| Update mechanism | `/gstack-upgrade` self-updater | `git pull` in dotfiles |

## Extending steez

### Adding a new skill

1. Create `dotfiles/claude/.claude/skills/steez-{name}/SKILL.md`
2. Use the preamble pattern from any existing skill (copy and change `SKILL_NAME`)
3. Stow deploys it automatically (directory folding)

### Porting another gstack skill

1. Copy source from `~/.claude/skills/gstack/{skill}/SKILL.md`
2. Apply the porting recipe (documented in FORK_MANIFEST.md patches column):
   - Replace preamble, strip onboarding, adapt voice, update paths
3. Update FORK_MANIFEST.md with the new entry
4. If the skill has supporting docs (like review's checklists), copy and clean those too

### Updating from upstream

1. Check gstack version: `cat ~/.claude/skills/gstack/VERSION`
2. Diff per-skill: `diff ~/.claude/skills/gstack/{skill}/SKILL.md dotfiles/claude/.claude/skills/steez-{skill}/SKILL.md`
3. Cherry-pick functional changes (skip template/onboarding diffs)
4. Update FORK_MANIFEST.md with new upstream version
