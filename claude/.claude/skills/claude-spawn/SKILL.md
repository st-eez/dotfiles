---
name: claude-spawn
description: "REQUIRED for spawning, launching, or orchestrating Claude Code agents — takes priority over the tmux skill when the user's intent is to start a new Claude instance. Use this skill (not tmux) whenever the user mentions 'claude', 'agent', or 'instance' in the context of spawning, launching, starting, or orchestrating. Trigger on: 'spawn claude', 'launch an agent', 'spin up another claude', 'fire up a claude instance', 'start claude in a new pane', 'send claude to work on X', 'I need a claude working on Y', 'orchestrate claude agents', 'start an autonomous claude session', or 'put claude in a worktree'. Even if the user mentions tmux panes, windows, or sessions, if they want to CREATE a Claude agent there, this skill handles it — tmux is only for raw tmux operations without Claude involved."
---

# Claude Spawn — Tmux-based Claude Code Orchestrator

Spawn a new Claude Code instance in a tmux target. This skill is project-agnostic.

## Step 1 — Parse user intent

Extract everything from what the user already said. The user's request IS the configuration — do not ask questions the user already answered or that have obvious defaults.

Parse these three fields **independently**, then combine into script args:

### 1. Topology (how to create the pane)

- Explicit "new window" or "new tab" → `new-window`
- Explicit "new session" → `new-session` (ask for session name only if not provided)
- "beside", "next to", "side by side", "split" → `split-h`
- "in this window", "in this pane", "here" → `split-h`
- "below", "above", "stacked" → `split-v`
- **Default** (no locality or split cue at all) → `new-window`

**Precedence rule:** If the user said ANY locality word ("this", "here", "beside", "in window"), that is a split cue. The default `new-window` ONLY applies when there is zero locality language. Never let the default override an explicit split cue.

### 2. Anchor (where to create it)

- "this pane", "beside me", "here" (no window number) → current pane (no `--target` needed)
- "this window", "in this window" (no number) → current pane (no `--target` needed)
- "window N", "this window (N)", "in tmux window (N)", "in window N" → target window N
  - If N is the caller's current window → no `--target` needed
  - If N is a different window → use `--target <session>:N.1` (first pane in that window)
- "pane N.M", explicit `session:window.pane` → use `--target` with exact address
- Parenthetical numbers like `(2)` are **identifiers** — the user naming which window they mean. They are NOT requests to create a new window.

### 3. Combine into script args

| Topology | Anchor | Script call |
|----------|--------|-------------|
| `split-h` | current pane | `spawn.sh split-h` |
| `split-h` | window N (same as current) | `spawn.sh split-h` |
| `split-h` | window N (different) | `spawn.sh split-h --target <session>:N.1` |
| `split-h` | exact pane | `spawn.sh split-h --target <pane-addr>` |
| `split-v` | (same patterns) | `spawn.sh split-v [--target ...]` |
| `new-window` | — | `spawn.sh new-window` |
| `new-session` | — | `spawn.sh new-session [--session <name>]` |

**Examples of correct parsing:**

| User says | Topology | Anchor | Result |
|-----------|----------|--------|--------|
| "spawn claude beside me" | `split-h` | current pane | `split-h` |
| "spawn a claude in this tmux window (2)" | `split-h` | window 2 | `split-h` (if already in 2) |
| "put claude in window 3" | `split-h` | window 3 | `split-h --target mac:3.1` |
| "new window with claude" | `new-window` | — | `new-window` |
| "spawn claude" (no locality) | `new-window` | — | `new-window` |
| "start claude below" | `split-v` | current pane | `split-v` |

**Working directory** — tmux inherits the cwd of the source pane on split/new-window, so skip this entirely unless the user explicitly mentions a different path or worktree. Rules:
- User mentions a specific path → cd to that path after creating the pane
- User mentions a worktree → ask for the worktree name only if not provided
- User says nothing about directory → **do nothing** (tmux handles it)

**Initial prompt** — infer from the user's task description:
- User says "to fix the tests", "to work on X", "have it do Y" → that's the prompt
- User says nothing about a task → no prompt, just open Claude

**Only use AskUserQuestion for things you genuinely cannot infer.** If the user said "spawn claude beside me", proceed directly with zero questions.

## Step 2 — Spawn via helper script

Run the `spawn.sh` script in a **single Bash call**. The script handles everything: tmux validation, pane ID detection, directory resolution (zoxide-backed), Claude launch, and readiness polling.

```bash
$HOME/.claude/skills/claude-spawn/spawn.sh <target-type> [--dir <name-or-path>] [--session <name>] [--prompt <text>] [--target <pane>]
```

**Target types:** `split-h`, `split-v`, `new-window`, `new-session`

**Flags:**
- `--dir <name-or-path>` — working directory (resolved via zoxide cascade)
- `--session <name>` — session name (for `new-session` only)
- `--prompt <text>` — initial prompt to send after Claude starts
- `--target <pane>` — for `split-h`/`split-v`: split this pane instead of self. Use `session:window.pane` format (e.g., `mac:5.1`). **Critical for multi-agent spawns** — without this, splits always happen in the caller's window.

**Examples:**
```bash
# Simple spawn beside current pane
$HOME/.claude/skills/claude-spawn/spawn.sh split-h

# Spawn in a specific directory with a task
$HOME/.claude/skills/claude-spawn/spawn.sh new-window --dir scratchpad --prompt "fix the failing tests"

# Spawn in a new session
$HOME/.claude/skills/claude-spawn/spawn.sh new-session --session agent-1 --prompt "run the test suite"

# Split a REMOTE pane (not self) — use TARGET from a previous spawn
$HOME/.claude/skills/claude-spawn/spawn.sh split-h --target mac:5.1 --dir other-project --prompt "run linter"
```

**Multi-agent pattern** (2+ agents in a new window):

When spawning multiple agents side-by-side in a new window, you MUST use `--target` on the second spawn. Otherwise the split happens in YOUR window, not the new one.

```bash
# Step 1: Create new window with first agent → returns TARGET=mac:5.1
$HOME/.claude/skills/claude-spawn/spawn.sh new-window --dir project-a --prompt "task A"

# Step 2: Split THAT pane to add second agent → returns TARGET=mac:5.2
$HOME/.claude/skills/claude-spawn/spawn.sh split-h --target mac:5.1 --dir project-b --prompt "task B"
```

Parse the `TARGET=...` value from step 1's output and pass it as `--target` in step 2.

**Reading the output:**

The script outputs structured key=value lines:
- `RESOLVED=/full/path METHOD=zoxide` — directory was resolved (method: literal, local, zoxide, or find)
- `SELF=mac:4.1 TARGET=mac:4.2` — pane addresses
- `READY` — Claude is up and accepting input
- `PROMPT_SENT` — initial prompt was delivered

**Error handling:**

- `ERROR: ...` + exit 1 — something failed (not in tmux, split failed, directory not found). No orphan panes are created if directory resolution fails.
- `AMBIGUOUS=N` + `CANDIDATE=...` lines + exit 2 — multiple directory matches. Present the candidates to the user and re-run with the full path via `--dir /full/path/here`.
- No `READY` line after the script completes — Claude failed to start within 25 seconds. Check the target pane manually.

**Directory resolution** uses a tiered cascade:
1. Literal paths (`/foo`, `~/foo`, `./foo`) → used directly
2. `$PWD/$name` child check → one stat call, catches "this project's tests/"
3. Zoxide query → frecency-ranked, handles partial matches ("scratch" → "scratchpad")
4. `find $HOME -maxdepth 4` exact name → depth-ranked, picks shallowest
5. `find $HOME -maxdepth 4` glob → never auto-resolves, always returns candidates

## Step 3 — Report

After spawning, report:
- The tmux target address (e.g., `work:2.0`)
- The working directory
- Whether an initial prompt was sent
- How to check on it: `tmux capture-pane -t <target> -p | tail -20`
- How to switch to it: `tmux select-window -t <target>` or `tmux switch-client -t <target>`

In the report, mention that `/loop` is available if they want periodic monitoring of the spawned agent. Don't use AskUserQuestion — just include it as a one-liner like "Let me know if you want to set up a /loop to monitor it."
