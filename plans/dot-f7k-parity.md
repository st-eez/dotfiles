# dot-f7k: Claude Notification.idle_prompt hook parity audit

Bead: `dot-f7k` (depends on `dot-y4a` — agent-monitor daemon shipped).

Goal: prove the daemon subsumes every notification path the Claude-only `Notification.idle_prompt` hook covers, then remove the hook to eliminate double notifications.

## Scope

- Hook under review: `claude/.claude/hooks/tmux-notify.sh` wired via `hooks.Notification[0]` (matcher `idle_prompt`) in `claude/.claude/settings.json`.
- Daemon under review: `agent-monitor/.local/bin/agent-monitor-daemon` (Python, live since dot-y4a).
- Classifier: `~/.steez/repo/shared/steez/bin/agent-state` (authoritative state source for all four agents: ren, ren-codex, claude, codex).

Code-level audit only — no live Claude session spawned, per bead instruction.

## Claude idle_prompt → agent-state classification

Claude's `Notification` hook with matcher `idle_prompt` fires when Claude is waiting on user input. The three cases that produce `idle_prompt`:

1. **Permission request** (e.g. "Do you want to proceed?" Tool approval).
   - Fast-path hook: `PermissionRequest` → `steez-permission-state.sh` writes attention record `$STEEZ_STATE_DIR/eventsd/attention/<pane>.json` with `state=blocked:permission` (see `agent-state` lines 48–51, 783–809).
   - Screen fallback: `screen_blocked_state()` at `agent-state:456-467` matches tail text `"Tab to amend" | "Do you want to proceed?" | "Do you want to overwrite"` → `blocked:permission`.
   - Either path makes `agent-state --all --json` emit `"state": "blocked:permission"`.

2. **AskUserQuestion prompt**.
   - Fast-path hook: `PreToolUse` matcher `AskUserQuestion` → `steez-permission-state.sh` writes `blocked:question` attention record.
   - Transcript path: `claude_state()` at `agent-state:196-252` walks the rollout JSONL in reverse; unresolved `AskUserQuestion` tool_use block returns `blocked:question` (lines 248-249). Mirrored in `artifact_state` emit path at lines 692-693.
   - Screen fallback at line 461-462: `"Enter to select" && "Chat about this"` → `blocked:question`.

3. **Generic end-of-turn idle nudge** (Claude's 60s native idle timer).
   - Transcript: `system` event with subtype `turn_duration` or `stop_hook_summary` → `idle` (`agent-state:217-220`, `661-664`).
   - Assistant message with `stop_reason == "end_turn"` → `idle` (`agent-state:235-236`, `679-680`).
   - `Stop` fast-path hook also writes attention record via `steez-permission-state.sh`.

All three idle_prompt triggers land in one of `{idle, blocked:permission, blocked:question}`.

## Daemon behavior on those states

`agent-monitor-daemon`:

- Polls `agent-state --all --json` every 2s (`daemon_loop`, interval default `2.0`, arg at line 358).
- `is_attention_state(state)` at line 230-231: returns `True` for `state == "idle"` OR `state.startswith("blocked:")`. Covers `idle`, `blocked:permission`, `blocked:question`, `blocked:unknown`.
- On transition `prior == "working"` → `is_attention_state(state)` (line 328):
  - Emits one `attention_transition` JSON line to stdout (`emit_transition`, line 256-270).
  - Marks the owning tmux window with `@agent_monitor_attention=1` (`mark_tmux_window_attention`, line 213-214, called via `sync_tmux_attention` line 310).
  - If `window_id not in visible_windows` (line 334), fires exactly one `osascript display notification` via `send_notification` (line 238-253).
- `visible_windows` = union of `#{window_id}` from `tmux list-clients` across all attached clients (`list_visible_tmux_windows`, line 204-206). A window is "visible" iff at least one attached client is currently viewing it.

## Side-by-side: when each fires

| Trigger | Hook (`tmux-notify.sh`) | Daemon |
|---|---|---|
| Source event | Claude-emitted `Notification` hook w/ matcher `idle_prompt` | agent-state transition `working → idle | blocked:*` (2s polling) |
| Scope | Claude only | ren, ren-codex, claude, codex |
| Latency | ~60s (Claude's native idle timer before emitting idle_prompt) | ≤2s (poll cycle) |
| Visibility gate | `tmux display-message -p '#{window_active}'` on the hook's `$TMUX_PANE`; fires iff `window_active != 1` (session-scoped active window) | `window_id ∉ list-clients` (hidden from every attached client) |
| Side effect | `osascript display notification` with title `Claude Code` | `osascript display notification` with title `Agent needs attention` + set `@agent_monitor_attention=1` on window |
| De-dup | None (fires every time Claude emits idle_prompt) | Per-pane `previous_states` map; only fires on edge `working → attention`, not while parked in attention |

## Coverage check — is hook ⊆ daemon?

Every event the hook fires for:

1. **Permission prompt while hidden** — daemon detects `working → blocked:permission` via attention record + screen fallback, window hidden → notifies. **Covered.**
2. **AskUserQuestion while hidden** — daemon detects `working → blocked:question` via transcript/attention/screen, window hidden → notifies. **Covered.**
3. **End-of-turn idle while hidden** — daemon detects `working → idle` via transcript `end_turn` / `turn_duration` / `stop_hook_summary`, window hidden → notifies. **Covered.**

Visibility: hook's `#{window_active}` (the session's active window) is a subset of the daemon's `list-clients` definition. If the window is not the session's active window, it is also not in any client's current view. The daemon's gate is at least as permissive — it suppresses notifications in strictly more "visible" situations, so any case the hook would fire on, the daemon also considers hidden.

Conversely, the daemon fires on cases the hook never catches:
- Non-Claude agents (ren, codex, ren-codex).
- Sub-60s idle transitions (daemon fires at 2s; Claude waits 60s before emitting idle_prompt).
- Blocked states Claude's hook system does not classify as idle_prompt (e.g. `blocked:unknown` from screen fallback).

## Verdict

**PARITY_HOLDS.**

The hook's coverage is a strict subset of the daemon's. Removing the hook eliminates the double-notification on every Claude idle_prompt (one from hook, one from daemon's transition) without losing any notification path.

## Action

- Delete `claude/.claude/hooks/tmux-notify.sh`.
- Remove `hooks.Notification` key from `claude/.claude/settings.json` via `jq 'del(.hooks.Notification)'`.
- Verify `jq '.hooks | has("Notification")'` → `false` and `jq '.hooks | keys | length'` → 8.
- Live settings at `~/.claude/settings.json` left untouched per bead (out of scope for this worktree).
