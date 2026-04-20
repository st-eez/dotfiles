#!/usr/bin/env bash
# Called from tmux `after-select-window` with the entered window_id.
# Retires sticky spawner-scoped agent attention (steez-ht6x) for every
# pane inside the window by invoking `agent-eventsd ack --spawner`.
#
# Shell-out target, not inline in tmux.conf, because tmux format
# expansion in run-shell commands consumes `$var` references (they get
# resolved against tmux's environment and come back empty), which
# breaks any while/read loop we try to write inline.
#
# PATH prefix matches sketchybar/helpers/agent_attention.sh: tmux's
# run-shell inherits whatever env tmux was started in, which on fresh
# logins omits ~/.steez/bin.
set -eu

win="${1:-}"
[[ -n "$win" ]] || exit 0

export PATH="$HOME/.steez/bin:$HOME/.local/bin:$PATH"
command -v agent-eventsd >/dev/null 2>&1 || exit 0
command -v tmux >/dev/null 2>&1 || exit 0

# `ack` is a no-op for panes that never spawned an agent, so iterating
# every pane in the entered window is cheap and correct even when the
# window holds non-agent panes.
tmux list-panes -t "$win" -F '#{pane_id}' 2>/dev/null | while IFS= read -r pane; do
  [[ -n "$pane" ]] || continue
  agent-eventsd ack --spawner "$pane" >/dev/null 2>&1 || true
done
