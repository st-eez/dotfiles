# dot-y4a — Ship agent-monitor daemon (steez-owned agent-state, no vendoring)

## Metadata

- Bead: `dot-y4a`
- Label: `agent-monitor`
- Supersedes: `dot-ktn.8`, `dot-ktn.9` (closed with supersede reason)
- Repo: `/Users/stevedimakos/Projects/Personal/dotfiles`
- Related repo: `/Users/stevedimakos/.steez/repo/shared/steez` (owns `agent-state`)
- Plan artifact: `plans/dot-y4a-agent-monitor-ship-design-spec.md`

## Context

The original `dot-ktn` chain (`.1`–`.7` closed) shipped code for an agent-monitor daemon plus tmux wiring plus a vendored copy of `agent-state` inside the dotfiles package. The feature never actually stowed — nothing ships to `~/.local/bin/` today — because `dot-ktn.9` was filed the moment `agent-state` started evolving inside steez. The vendored copy (598 lines, Apr 13) is now stale vs. the live steez copy (1282 lines). The contract the daemon consumes (`--all --json`, keys `pane/agent/state/name`, state vocabulary `idle|working|blocked:{question,permission,unknown}`) is still compatible, but the vendored copy is missing all state-detection improvements made since Apr 13.

Root cause of the stall: **two copies of `agent-state` is the wrong shape**. The vendoring decision was the mistake.

Actual problem the feature solves: agent panes running in hidden tmux windows go idle or block on a prompt without the user noticing. The existing Claude Code `Stop` hook covers Claude only. This daemon gives agent-agnostic attention signaling (tmux dot + one macOS notification) for anything `agent-state` recognizes.

## Goals

- Exactly one copy of `agent-state` on disk — the live one at `~/.steez/repo/shared/steez/bin/agent-state`.
- Dotfiles ships one binary: `agent-monitor-daemon`.
- `~/.local/bin/agent-state` continues to exist as a pointer (for daemon + existing steez callers migrated in `dot-ktn.7`).
- Daemon autostarts once per tmux server and survives re-source.
- Hidden-window `working → idle|blocked:*` transition fires exactly one macOS notification and sets the tmux `@agent_monitor_attention` dot.
- Visible-window `working → idle|blocked:*` transition sets the dot only (no notification).
- Daemon shutdown clears all tmux attention options.

## Non-goals

- Rewriting the daemon. `agent-monitor/.local/bin/agent-monitor-daemon` is kept as-is; it already resolves `agent-state` via `shutil.which`, and its logic has been verified elsewhere in `dot-ktn.3`–`.5`.
- Changing `agent-state` itself.
- Retiring the Claude-only `Stop` hook. That stays as a safety net; retirement is a later decision with its own bead once parity is lived-with.
- Updating documentation in other repos (`~/.claude/plans/sorted-inventing-harp.md` etc.). That planning doc is now historical; this spec replaces it.

## Constraints & assumptions

- Dotfiles repo is user-specific; absolute paths containing `/Users/stevedimakos/` are acceptable (precedent: `codex/.codex/skills/{spawn-agent,spec,tdd}` are absolute symlinks to steez).
- `~/.steez/repo/shared/steez/bin/agent-state` exists and is executable on every machine where this feature is expected to run. If it does not, the daemon fails fast at startup — acceptable.
- GNU stow is the installation mechanism; `~/.local/bin` already exists and is stow-managed (`agent-monitor` would fold into the same target directory).
- `__pycache__/` is already gitignored at repo root; no new ignore rules needed.
- tmux is the active multiplexer; the indicator is tmux-specific.
- macOS is the notification target (`osascript`); non-macOS is out of scope.

## Requirements

1. `agent-monitor/.local/bin/` contains:
   - `agent-monitor-daemon` (unchanged Python executable)
   - `agent-state` as a **symlink** to `/Users/stevedimakos/.steez/repo/shared/steez/bin/agent-state`
   - No other binaries; no `__pycache__` in git.
2. `installer/config.sh` registers `agent-monitor` with:
   - Homebrew/pacman/apt package names: empty string (config-only).
   - Binary name: `agent-monitor-daemon` (not `agent-state`).
   - Description: `Agent state monitor daemon` (or equivalent).
3. `tmux/.config/tmux/tmux.conf` contains the guarded autostart block and the `@agent_monitor_attention` indicator token in `window-status-format`.
4. After `stow --restow agent-monitor`:
   - `~/.local/bin/agent-monitor-daemon` exists and is executable.
   - `~/.local/bin/agent-state` is a symlink that resolves to the live steez copy.
5. After tmux re-source, exactly one `agent-monitor-daemon` process runs (verified via singleton pidfile at `~/.local/state/agent-monitor/pid`).
6. Hidden-window attention transition emits one macOS notification; visible-window does not.

## Proposed design

**Shape change vs. current working tree:**

| File | Current (uncommitted) | After |
|---|---|---|
| `agent-monitor/.local/bin/agent-state` | 598-line vendored copy | symlink → `/Users/stevedimakos/.steez/repo/shared/steez/bin/agent-state` |
| `agent-monitor/.local/bin/agent-monitor-daemon` | Python daemon (unchanged) | same |
| `agent-monitor/.local/bin/__pycache__/` | present on disk (gitignored) | ignored; not committed |
| `installer/config.sh` — `get_binary_name` for `agent-monitor` | `agent-state` | `agent-monitor-daemon` |
| `installer/config.sh` — description | `Agent state detector` | `Agent state monitor daemon` |
| `tmux.conf` | autostart + `@agent_monitor_attention` indicator added | same |

**Symlink rationale:** matches dotfiles' existing pattern for `codex/.codex/skills/{spawn-agent,spec,tdd}` — absolute-path symlinks into steez. One source of truth, no drift, no file duplication, no new install step. The daemon's existing `resolve_agent_state_bin` finds the symlinked `agent-state` via `shutil.which` because `~/.local/bin` is on `PATH`.

**Why change the installer `get_binary_name`:** the function returns the file name the installer uses to verify the package is "installed" (i.e., test-executed for `--version` or existence). The actually-installed, actually-dotfiles-owned binary is `agent-monitor-daemon`. `agent-state` is a symlink into a different repo; treating it as the package identity confuses installation verification.

**Daemon behavior is unchanged** and out of scope for edits. The flow (from code read at `agent-monitor/.local/bin/agent-monitor-daemon`):

- `start --detach` → checks singleton → forks `run` with stdio detached → returns.
- `run` → acquires singleton lock (`~/.local/state/agent-monitor/{lock,pid}`) → resolves `agent-state` / `tmux` / `osascript` bins → clears all tmux `@agent_monitor_attention` on startup → loops every 2s.
- Each cycle: parse `agent-state --all --json`, enrich with `tmux list-panes` metadata, compute attention window set, `set-window-option @agent_monitor_attention` or clear as needed, detect `working → attention` transitions, emit JSON transition to stdout, send macOS notification iff the pane's window is not in `tmux list-clients` visible set.
- SIGINT/SIGTERM → clear all tmux attention → exit.

## Interface contracts

**agent-monitor-daemon CLI** (unchanged, documented here for completeness):

```
agent-monitor-daemon run     [--agent-state-bin PATH] [--tmux-bin PATH] [--osascript-bin PATH] [--interval SECS] [--max-cycles N]
agent-monitor-daemon start   [--detach] [same flags as run]
agent-monitor-daemon status  # exit 0 if running, 1 if not
```

**agent-state consumed shape** (owned by steez; this repo only reads it):

```json
[
  {"pane": "%921", "agent": "ren", "state": "idle", "name": "ren", ...}
]
```

- Required keys: `pane` (tmux pane id), `agent`, `state`, `name`.
- Recognized `state` values: `idle`, `working`, `blocked:question`, `blocked:permission`, `blocked:unknown`.
- Additive extensions (e.g., `detail` object) are ignored.
- Contract violation (non-array, missing `state`, etc.) → daemon logs to stderr and continues next cycle.

**tmux option:**

- `@agent_monitor_attention=1` set on windows containing an attention-state pane.
- Unset (not `0`) on windows that don't.
- Consumed in `window-status-format` as `#{?@agent_monitor_attention, #[fg=…]●,}`.

**Runtime files:**

- `~/.local/state/agent-monitor/lock` — flock for singleton.
- `~/.local/state/agent-monitor/pid` — current daemon pid.

## Acceptance criteria

1. `agent-monitor/.local/bin/agent-state` is a symlink, not a regular file, in the committed tree.
2. `readlink -f agent-monitor/.local/bin/agent-state` resolves to the same file as `readlink -f /Users/stevedimakos/.steez/repo/shared/steez/bin/agent-state` (the live steez agent-state).

   > **Deviation note (AC2).** Original AC2 read: `readlink agent-monitor/.local/bin/agent-state == /Users/stevedimakos/.steez/repo/shared/steez/bin/agent-state`. Changed because GNU stow 2.4.1 (`Stow.pm:503-514`) hard-refuses to stow a package file that is itself an absolute symlink ("source is an absolute symlink ... All operations aborted"), making the original absolute-symlink form incompatible with AC4's "no conflicts" requirement. The package symlink is therefore a relative path (`../../../../../../.steez/repo/shared/steez/bin/agent-state`) that still resolves to the live steez copy. The equality form uses `readlink -f` on both sides rather than a literal string match because `~/.steez/repo` is itself a symlink to `~/Projects/Personal/steez`, so the fully-resolved path is `/Users/stevedimakos/Projects/Personal/steez/shared/steez/bin/agent-state` — pinning to `~/.steez/repo/...` literally would fail on any machine where that indirection exists.
3. `installer/config.sh` sets `agent-monitor`'s binary name to `agent-monitor-daemon` in `get_binary_name`.
4. `stow --dir=$HOME/Projects/Personal/dotfiles --target=$HOME --simulate --verbose --restow agent-monitor` prints LINK actions for both `agent-monitor-daemon` and `agent-state` into `~/.local/bin/` with no conflicts.
5. After real `stow --restow agent-monitor`, `~/.local/bin/agent-state` resolves (via symlink chain) to `/Users/stevedimakos/.steez/repo/shared/steez/bin/agent-state`, and `~/.local/bin/agent-monitor-daemon` exists and `--help` runs.
6. `agent-monitor-daemon status` returns `stopped` before start and `running <pid>` after `agent-monitor-daemon start --detach`.
7. Two back-to-back `agent-monitor-daemon start --detach` calls yield the same `status` pid (singleton enforced).
8. Running the daemon with `--max-cycles 1` against the live `agent-state` in the current tmux session completes with exit 0, prints zero or more transition JSON lines, and leaves tmux attention options only on windows whose panes are in an attention state at that instant.
9. After daemon exits (SIGTERM), `tmux show-window-options -g` (scoped per-window) shows no `@agent_monitor_attention` set on any window.
10. tmux source-file reload with the daemon not running starts exactly one daemon (pidfile present, status running). A second source-file reload leaves the pid unchanged.
11. A hidden-window `working → idle` transition produces exactly one `osascript display notification` call and sets the tmux dot on the target window.
12. A visible-window `working → idle` transition produces zero notifications but still sets the tmux dot.

## Verification commands

Run from repo root unless noted. All are hermetic except the two clearly-marked smokes in slice 5 (see Isolation rule columns in slices).

```sh
# Source-of-truth checks (static)
test -L agent-monitor/.local/bin/agent-state
[ "$(readlink -f agent-monitor/.local/bin/agent-state)" = "$(readlink -f /Users/stevedimakos/.steez/repo/shared/steez/bin/agent-state)" ]
grep -q 'agent-monitor)   echo "agent-monitor-daemon"' installer/config.sh
! test -f agent-monitor/.local/bin/__pycache__/agent-monitor-daemoncpython-314.pyc || git check-ignore agent-monitor/.local/bin/__pycache__/agent-monitor-daemoncpython-314.pyc

# Installer consistency check
bash -n installer/config.sh

# Stow dry-run
stow --dir="$HOME/Projects/Personal/dotfiles" --target="$HOME" --simulate --verbose --restow agent-monitor 2>&1 | grep -E "LINK: \.local/bin/(agent-state|agent-monitor-daemon)"

# Post-stow resolution (real stow)
stow --dir="$HOME/Projects/Personal/dotfiles" --target="$HOME" --restow agent-monitor
test -L "$HOME/.local/bin/agent-state"
test -x "$(readlink -f "$HOME/.local/bin/agent-state")"
test -x "$HOME/.local/bin/agent-monitor-daemon"
"$HOME/.local/bin/agent-monitor-daemon" --help | grep -q 'status'

# Daemon lifecycle smoke
"$HOME/.local/bin/agent-monitor-daemon" status  # expect: stopped, exit 1
"$HOME/.local/bin/agent-monitor-daemon" start --detach
"$HOME/.local/bin/agent-monitor-daemon" status  # expect: running <pid>, exit 0
kill "$(cat $HOME/.local/state/agent-monitor/pid)"
sleep 1
"$HOME/.local/bin/agent-monitor-daemon" status  # expect: stopped

# Singleton
"$HOME/.local/bin/agent-monitor-daemon" start --detach
PID1="$(cat $HOME/.local/state/agent-monitor/pid)"
"$HOME/.local/bin/agent-monitor-daemon" start --detach
PID2="$(cat $HOME/.local/state/agent-monitor/pid)"
[ "$PID1" = "$PID2" ]
kill "$PID1"

# tmux autostart (inside a tmux session)
tmux source-file "$HOME/.config/tmux/tmux.conf"
sleep 2
"$HOME/.local/bin/agent-monitor-daemon" status  # expect: running
tmux source-file "$HOME/.config/tmux/tmux.conf"
sleep 2
[ "$(cat $HOME/.local/state/agent-monitor/pid)" = "$PID1" ]  # pid should match first start
```

## Implementation slices

Each slice is independently verifiable and maps to one `/tdd` pass.

### Slice 1 — Replace vendored agent-state with symlink

- **Slice ID:** `y4a-1`
- **Title:** Replace vendored `agent-state` with a steez symlink
- **Goal:** One `agent-state` exists on disk (the live steez copy). The dotfiles package points at it.
- **Behavior under test:** After applying the slice, the committed tree has `agent-monitor/.local/bin/agent-state` as a symlink whose target string is `/Users/stevedimakos/.steez/repo/shared/steez/bin/agent-state`, and the old 598-line regular-file copy is gone.
- **Seam under test:** file-system surface of the dotfiles package (what `git ls-files` returns and what `readlink` says).
- **Boundary:** the `agent-monitor/` package directory only. Does not touch installer or tmux.
- **Files likely touched:**
  - Delete: `agent-monitor/.local/bin/agent-state` (regular file)
  - Create: `agent-monitor/.local/bin/agent-state` (symlink)
- **Red test name:** `slice_1_agent_state_is_symlink_to_steez`
- **Fixture / harness:** shell assertions running in the repo root with no live daemon.
- **Isolation rule:** read-only against the filesystem except for the explicit `rm` and `ln -s` operations in the slice's green step; no network; no tmux; no daemon.
- **Determinism rule:** target string is a relative path from the package file (`../../../../../../.steez/repo/shared/steez/bin/agent-state`) that resolves to the live steez copy; no `$HOME` expansion. (Originally specified as absolute — see AC2 deviation note.)
- **Assertion contract:** `test -L agent-monitor/.local/bin/agent-state` AND `[ "$(readlink -f agent-monitor/.local/bin/agent-state)" = "$(readlink -f /Users/stevedimakos/.steez/repo/shared/steez/bin/agent-state)" ]` AND `git diff --stat` shows deletion of the old 598-line file.
- **Green condition:** both asserts pass; `git status` lists the file as modified (type change from regular to symlink).
- **Refactor target:** none — single-file change.
- **Smoke budget:** none.
- **Verification command:**
  ```sh
  test -L agent-monitor/.local/bin/agent-state \
    && [ "$(readlink -f agent-monitor/.local/bin/agent-state)" = "$(readlink -f /Users/stevedimakos/.steez/repo/shared/steez/bin/agent-state)" ] \
    && echo OK
  ```

### Slice 2 — Installer registers `agent-monitor-daemon` as the binary

- **Slice ID:** `y4a-2`
- **Title:** Fix `installer/config.sh` binary name + description
- **Goal:** Installation verification treats `agent-monitor-daemon` (dotfiles-owned) as the package's identity, not `agent-state` (steez-owned symlink target).
- **Behavior under test:** `get_binary_name agent-monitor` prints `agent-monitor-daemon`. `get_pkg_description agent-monitor` prints a description that mentions the monitor, not just "state detector".
- **Seam under test:** the `get_binary_name` and `get_pkg_description` shell functions in `installer/config.sh`.
- **Boundary:** `installer/config.sh` only.
- **Files likely touched:** `installer/config.sh` (two line edits).
- **Red test name:** `slice_2_binary_name_returns_agent_monitor_daemon`
- **Fixture / harness:** sourced shell snippet that invokes the functions.
- **Isolation rule:** no external process calls; `bash -n` only for syntax; pure function invocation for semantics.
- **Determinism rule:** pass a fixed input (`agent-monitor`) and assert fixed output.
- **Assertion contract:**
  ```sh
  (
    source installer/config.sh
    [ "$(get_binary_name agent-monitor)" = "agent-monitor-daemon" ] && \
    get_pkg_description agent-monitor | grep -qi 'monitor'
  )
  ```
- **Green condition:** both asserts pass; `bash -n installer/config.sh` clean.
- **Refactor target:** none.
- **Smoke budget:** none.
- **Verification command:**
  ```sh
  bash -c 'source installer/config.sh && [ "$(get_binary_name agent-monitor)" = "agent-monitor-daemon" ] && get_pkg_description agent-monitor | grep -qi monitor && echo OK'
  ```

### Slice 3 — Stow topology is conflict-free and links resolve correctly (hermetic)

- **Slice ID:** `y4a-3`
- **Title:** Validate stow topology against a temp target
- **Goal:** Simulate-stow into an empty scratch target to prove no conflicts and that the resulting link targets resolve to the expected files.
- **Behavior under test:** stow against the `agent-monitor` package emits two `LINK` actions — one for `agent-state` and one for `agent-monitor-daemon` — and zero `CONFLICT` lines. After real stow into the scratch target, both resulting symlinks exist and resolve to executable files.
- **Seam under test:** `stow --simulate --verbose --restow agent-monitor` output plus the filesystem state of a clean scratch target after real stow.
- **Boundary:** a fresh `$(mktemp -d)/home/.local/bin/` target. Does not touch the user's real `~/.local/bin/`.
- **Files likely touched:** none in repo (verification only).
- **Red test name:** `slice_3_stow_links_resolve_to_steez_in_scratch_target`
- **Fixture / harness:** scratch target dir created with `mktemp -d`; cleanup with `trap 'rm -rf "$TMP"' EXIT`.
- **Isolation rule:** no shared user state. Target is a mktemp dir, torn down at end. No network, no clock, no home-dir state.
- **Determinism rule:** scratch target starts empty; assertion is on exact link targets and executability.
- **Assertion contract:**
  ```sh
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  mkdir -p "$TMP/home/.local/bin"
  stow --dir="$HOME/Projects/Personal/dotfiles" --target="$TMP/home" --simulate --verbose --restow agent-monitor 2>&1 | tee "$TMP/sim.log"
  ! grep -qi 'CONFLICT' "$TMP/sim.log"
  [ "$(grep -c -E 'LINK: \.local/bin/(agent-state|agent-monitor-daemon) ' "$TMP/sim.log")" = "2" ]
  stow --dir="$HOME/Projects/Personal/dotfiles" --target="$TMP/home" --restow agent-monitor
  test -L "$TMP/home/.local/bin/agent-state"
  test -L "$TMP/home/.local/bin/agent-monitor-daemon"
  test -x "$(readlink -f "$TMP/home/.local/bin/agent-state")"
  test -x "$(readlink -f "$TMP/home/.local/bin/agent-monitor-daemon")"
  ```
- **Green condition:** all asserts pass and the scratch target is torn down.
- **Refactor target:** none.
- **Smoke budget:** none.
- **Verification command:** same as assertion contract.

### Slice 4 — Daemon singleton + shutdown cleanup against stubbed tmux/agent-state (hermetic)

- **Slice ID:** `y4a-4`
- **Title:** Singleton enforcement + SIGTERM clears tmux attention — via stub bins
- **Goal:** `start --detach`/`status` enforces singleton and SIGTERM triggers the `set-window-option -u` calls that clear `@agent_monitor_attention`.
- **Behavior under test:**
  1. `status` returns exit 1 when nothing is running.
  2. `start --detach` produces a pidfile and `status` returns exit 0.
  3. Second `start --detach` leaves the pidfile pid unchanged.
  4. After SIGTERM, the stub-tmux invocation log contains at least one line of the form `set-window-option -u -t <window_id> @agent_monitor_attention` for every window the daemon touched during its run.
- **Seam under test:** `agent-monitor-daemon` CLI + pidfile at `$STATE_DIR/pid` + the subprocess calls emitted by the daemon to `--tmux-bin`.
- **Boundary:** three stub binaries (`tmux`, `agent-state`, `osascript`) in a scratch dir; one scratch state dir. No real tmux server, no real `agent-state`, no real `osascript`.
- **Files likely touched:** none in repo (verification only; stubs live in `mktemp -d`).
- **Red test name:** `slice_4_daemon_singleton_and_shutdown_emits_cleanup_calls`
- **Fixture / harness:** scratch dir from `mktemp -d`. Stubs are shell scripts that (a) log their argv to a file, (b) emit deterministic canned output for `list-panes`, `list-windows`, `list-clients`, and `agent-state --all --json`. Daemon launched with explicit `--tmux-bin`, `--agent-state-bin`, `--osascript-bin` pointing at stubs. `HOME` overridden to the scratch dir so `~/.local/state/agent-monitor/` resolves there.
- **Isolation rule:** hermetic. No real network, no system clock usage beyond `sleep`, no real `~/.local/state/`, no real tmux server. Scratch dir torn down in `trap`.
- **Determinism rule:** stub-tmux emits one canned pane in one canned window; stub-agent-state returns a two-snapshot script (first `working`, second `idle`) keyed off an invocation counter file. All sleeps are explicit.
- **Assertion contract:**
  ```sh
  REPO="$HOME/Projects/Personal/dotfiles"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  export HOME="$TMP"
  mkdir -p "$TMP/stubs" "$TMP/.local/state/agent-monitor"
  # ... stub scripts written to $TMP/stubs/{tmux,agent-state,osascript} ...
  "$REPO/agent-monitor/.local/bin/agent-monitor-daemon" status; test $? -eq 1
  "$REPO/agent-monitor/.local/bin/agent-monitor-daemon" start --detach \
    --tmux-bin "$TMP/stubs/tmux" \
    --agent-state-bin "$TMP/stubs/agent-state" \
    --osascript-bin "$TMP/stubs/osascript" \
    --interval 0.1
  sleep 0.5
  PID1="$(cat "$TMP/.local/state/agent-monitor/pid")"
  [ -n "$PID1" ]
  "$REPO/agent-monitor/.local/bin/agent-monitor-daemon" start --detach \
    --tmux-bin "$TMP/stubs/tmux" --agent-state-bin "$TMP/stubs/agent-state" \
    --osascript-bin "$TMP/stubs/osascript"
  PID2="$(cat "$TMP/.local/state/agent-monitor/pid")"
  [ "$PID1" = "$PID2" ]
  kill -TERM "$PID1"
  sleep 0.5
  grep -qE 'set-window-option -u -t [^ ]+ @agent_monitor_attention' "$TMP/stubs/tmux.log"
  ```
- **Green condition:** all asserts pass.
- **Refactor target:** none.
- **Smoke budget:** none.
- **Verification command:** same as assertion contract.

### Slice 5 — tmux re-source does not spawn duplicate daemons

- **Slice ID:** `y4a-5`
- **Title:** Guarded autostart is idempotent under re-source
- **Goal:** The `if-shell` autostart block in `tmux.conf` starts the daemon once and no-ops on subsequent re-sources.
- **Behavior under test:** starting from a state where no daemon is running, `tmux source-file` once starts one; a second `tmux source-file` leaves the pid unchanged.
- **Seam under test:** the `if-shell` block in `tmux/.config/tmux/tmux.conf` that invokes `agent-monitor-daemon start --detach`.
- **Boundary:** tmux server + daemon. No changes to daemon or installer.
- **Files likely touched:** none (the autostart block already exists in the current working tree and is unchanged by this spec).
- **Red test name:** `slice_5_tmux_resource_is_idempotent`
- **Fixture / harness:** live tmux server.
- **Isolation rule:** smoke-exempt: tmux autostart is precisely the tmux-glue behavior the spec is wiring, and there is no way to test "re-source does not double-start" without re-sourcing a real tmux conf. One runtime smoke total.
- **Determinism rule:** explicit pre-kill of any running daemon before the first source-file call; explicit `sleep 2` after each source-file call; pid comparison after the second call.
- **Assertion contract:**
  ```sh
  PID_PATH="$HOME/.local/state/agent-monitor/pid"
  [ -f "$PID_PATH" ] && kill -TERM "$(cat "$PID_PATH")" 2>/dev/null || true
  rm -f "$PID_PATH" "$HOME/.local/state/agent-monitor/lock"
  tmux source-file "$HOME/.config/tmux/tmux.conf"
  sleep 2
  PID1="$(cat "$PID_PATH")"
  [ -n "$PID1" ]
  tmux source-file "$HOME/.config/tmux/tmux.conf"
  sleep 2
  PID2="$(cat "$PID_PATH")"
  [ "$PID1" = "$PID2" ]
  ```
- **Green condition:** PID1 non-empty after first source; PID2 equals PID1 after second source.
- **Refactor target:** none.
- **Smoke budget:** single allowed smoke (the tmux-glue one).
- **Verification command:** same as assertion contract.

## Alternatives considered

- **Keep vendoring, add a Makefile `sync-agent-state` target.** Rejected: still two files, just with a ceremony. User's stated constraint was "one file."
- **Move `~/.local/bin/agent-state` provisioning into steez itself.** Cleaner ownership (steez installs its own binary) but requires a steez-side install step that doesn't exist today and pushes dotfiles-adjacent wiring into a different repo. Deferred; the symlink achieves the "one file" constraint without the refactor.
- **Prepend `~/.steez/repo/shared/steez/bin` to `PATH` and drop `~/.local/bin/agent-state` entirely.** Would break steez-side callers migrated in `dot-ktn.7` that hardcode `~/.local/bin/agent-state`. Would also expose every binary in that steez dir on PATH, not just `agent-state`.

## Rollout & rollback

- Rollout: single commit containing the symlink change + `installer/config.sh` fix + keeping the already-written tmux.conf + daemon. After commit, run `stow --restow agent-monitor` manually to apply.
- Rollback: `git revert` plus `stow --delete agent-monitor`. Nothing persistent outside `~/.local/bin/` and `~/.local/state/agent-monitor/`; deleting those directories returns to pre-feature state.
- The Claude Code `Stop` hook is untouched; agent-attention signaling continues to work via that path for Claude even if this feature is rolled back.

## Open questions

None. The symlink-to-steez strategy resolves the prior `dot-ktn.9` audit by replacing "audit the vendored copy" with "delete the vendored copy." The daemon contract audit (JSON shape, state vocabulary, `--all --json` flag) was completed earlier in this session against the live 1282-line `agent-state` and is referenced in Context.
