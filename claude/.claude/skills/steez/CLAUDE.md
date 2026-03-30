# steez development

## Commands

```bash
# Browse binary
cd ~/.claude/skills/steez/browse
bun install                # install dependencies (playwright, diff)
bun run build              # compile browse + find-browse binaries + node server
bun test                   # run all tests except e2e (<5s, free)
bun test:core              # run core browser tests only
bun test:ns                # run NetSuite automation tests only
bun run dev <cmd>          # run CLI in dev mode (no compile step)

# Skill deployment (from dotfiles repo root)
stow --dir="$HOME/Projects/Personal/dotfiles" --target="$HOME" --simulate --verbose --restow claude
stow --dir="$HOME/Projects/Personal/dotfiles" --target="$HOME" --restow claude

# Helper scripts (steez/bin/)
steez-config get <key>           # read config value
steez-config set <key> <value>   # write config value
steez-slug                       # git remote → owner-repo slug
steez-diff-scope                 # categorize diff as frontend/backend/prompts/tests/docs/config
steez-review-log                 # append JSON review entry to project log
steez-review-read                # read review log + config for Review Readiness Dashboard
steez-bd resume                  # session brief: current bead, suggested skill, ready work
steez-bd start <id> [skill]      # claim bead + optional skill tag
steez-bd emit-finding <id> "t"   # create linked finding bead
steez-bd handoff <id> "s" [--close]  # append note + optional close
```

`bun test` runs before every commit to browse source. Both core and NS tests
start local HTTP servers with fixture HTML — no external dependencies, no
network calls, no credentials.

## Project structure

```
steez/                                    # shared home (this directory)
├── bin/                                  # 5 bash helper scripts
│   ├── steez-config                      # read/write ~/.steez/config
│   ├── steez-slug                        # git remote → owner-repo slug
│   ├── steez-diff-scope                  # categorize diff scopes
│   ├── steez-review-log                  # append review entries
│   └── steez-review-read                 # read review log + config
├── browse/                               # headless browser (Playwright + Chromium)
│   ├── src/
│   │   ├── core/                         # CLI + server + commands (~3,800 lines)
│   │   │   ├── cli.ts                    # entry point → dist/browse
│   │   │   ├── server.ts                 # HTTP daemon (~1,210 lines)
│   │   │   ├── commands.ts               # command dispatcher
│   │   │   ├── browser-manager.ts        # Playwright browser lifecycle
│   │   │   ├── snapshot.ts               # screenshot + annotation
│   │   │   ├── find-browse.ts            # binary locator → dist/find-browse
│   │   │   └── test/                     # 20 core test files + fixtures/
│   │   ├── ns/                           # NetSuite ERP automation (~2,100 lines)
│   │   │   ├── commands/                 # 10 NS commands (login, navigate, query, set, save, ...)
│   │   │   ├── convergence.ts            # wait for network idle
│   │   │   ├── mutex.ts                  # concurrency control
│   │   │   └── test/                     # 18 NS test files + fixtures/
│   │   └── playwright/                   # extensions (routing, tracing, video)
│   ├── bin/                              # find-browse shim, remote-slug helper
│   ├── scripts/                          # build-node-server.sh (Windows compat layer)
│   ├── dist/                             # compiled binaries (gitignored)
│   │   ├── browse                        # Mach-O arm64 (~57MB)
│   │   ├── find-browse                   # Mach-O arm64 (~57MB)
│   │   └── server-node.mjs              # Node.js compat server
│   └── package.json                      # scripts: build, test, dev
├── ETHOS.md                              # builder philosophy (Boil the Lake, Search Before Building)
├── ARCHITECTURE.md                       # design decisions + data flow
├── FORK_MANIFEST.md                      # upstream gstack provenance
├── README.md                             # ecosystem overview
└── CLAUDE.md                             # this file

steez-{skill}/                            # 21 workflow skills, each in its own directory
├── SKILL.md                              # skill definition (read by Claude Code)
└── (optional assets)                     # checklists, templates, references
    steez-review/   → checklist.md, design-checklist.md, greptile-triage.md, TODOS-format.md
    steez-qa/       → references/issue-taxonomy.md, templates/qa-report-template.md
    steez-cso/      → ACKNOWLEDGEMENTS.md
```

### Runtime (`~/.steez/`)

```
~/.steez/
├── config                                # key-value config (proactive: true)
├── sessions/                             # PID-based session tracking (auto-cleaned 2h TTL)
├── analytics/
│   ├── skill-usage.jsonl                 # every skill invocation (start + end events)
│   └── spec-review.jsonl                 # spec/review analytics
├── skill-reports/                        # Skill Self-Report bug reports ({slug}.md)
├── projects/{slug}/
│   ├── {branch}-reviews.jsonl            # review logs per branch
│   └── *-design-*.md                     # design docs from /steez-office-hours
└── browse/
    ├── chromium-profile/                 # persistent Chromium state (login sessions, cache)
    └── sidebar-sessions/                 # sidebar daemon sessions
```

### Stow deployment

The `claude` package uses directory folding. After `stow --restow claude`,
`~/.claude/skills/` is a symlink to `dotfiles/claude/.claude/skills/`. This means:

- Editing SKILL.md files in the repo changes them live immediately
- New skill directories appear instantly — no build or install step
- `steez/bin/` scripts are accessible at `$HOME/.claude/skills/steez/bin/`
- **Do NOT use `--no-folding`** for the `claude` package

## SKILL.md workflow

SKILL.md files are **hand-edited directly**. There is no template system, no
generation step, no `.tmpl` files. Edit a SKILL.md, it's live immediately.

**Tradeoff:** shared-section updates (preamble, voice, AskUserQuestion format)
must be applied to all 21 files manually. Use search-and-replace across
`steez-*/SKILL.md`.

When editing preambles across multiple skills, verify with:
```bash
# Check no broken escapes
grep -r '>\\\&2' ~/.claude/skills/steez-*/SKILL.md
# Check no stale references
grep -ric 'gstack' ~/.claude/skills/steez-*/SKILL.md | grep -v ':0$'
```

## Compiled binaries

`browse/dist/` contains compiled Bun binaries (~57MB each, Mach-O arm64).
These are gitignored but present on disk after `bun run build`.

**Rebuild after changing browse source:**
```bash
cd ~/.claude/skills/steez/browse && bun run build
```

The binaries only work on macOS arm64. The `server-node.mjs` fallback
provides Windows/Node.js compatibility.

## Browser interaction

When you need to interact with a browser (QA, dogfooding, cookie setup), use
the `/steez-browse` skill or run the browse binary directly via `$B <command>`.

Skills resolve `$B` with this pattern:
```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
B=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/.claude/skills/steez/browse/dist/browse" ] && B="$_ROOT/.claude/skills/steez/browse/dist/browse"
[ -z "$B" ] && B=~/.claude/skills/steez/browse/dist/browse
```

Resolution order: repo-local binary first, global fallback second.

## Editing skills

Each bash code block in a SKILL.md runs in a separate shell — variables don't
persist between blocks. Use prose to carry state ("the base branch detected
in Step 0"), not shell variables. Express conditionals as numbered English
steps, not nested `if/elif/else`. Don't hardcode branch names — detect
dynamically via `gh pr view` or `gh repo view`.

### Preamble pattern

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

Config fallback uses curly braces for correct `||` precedence:
```bash
_PROACTIVE=$("$STEEZ_BIN/steez-config" get proactive 2>/dev/null || { echo "[steez] WARNING: steez-config failed, defaulting proactive=true" >&2; echo "true"; })
```

## Commit style

Use conventional commits: `feat:` | `fix:` | `refactor:` | `docs:` | `chore:`

Prefer one commit per logical change. When you've made multiple changes
(e.g., a preamble fix + a branding removal + a new skill), split them into
separate commits. Each commit should be independently understandable.

## Helper script dependencies

```
steez-slug ← steez-review-log (needs SLUG for file path)
           ← steez-review-read (needs SLUG for file path)

steez-config ← steez-review-read (reads skip_eng_review)
             ← all skills (reads proactive in preamble)

steez-diff-scope — standalone, no dependencies

steez-bd ← all skills (beads context in preamble, non-blocking)
         ← office-hours (chain creation after design doc approved)
         ← plan-ceo-review (handoff at completion)
         ← plan-eng-review (handoff at completion)
         ← ship (handoff at completion, emit-finding for issues)
  Depends on: bd CLI (beads), jq (macOS system binary)
```

## Search before building

Before designing any solution that involves concurrency, unfamiliar patterns,
infrastructure, or anything where the runtime/framework might have a built-in:

1. Search for "{runtime} {thing} built-in"
2. Search for "{thing} best practice {current year}"
3. Check official runtime/framework docs

Three layers of knowledge: tried-and-true (Layer 1), new-and-popular (Layer 2),
first-principles (Layer 3). Prize Layer 3 above all. See ETHOS.md for the full
builder philosophy.
