#!/usr/bin/env bash
# Emit one TSV row per agent pane needing attention.
# Columns: pane_id<TAB>agent<TAB>state<TAB>name<TAB>window.pane
# Attention = idle or blocked:*. Working panes are excluded.
set -euo pipefail

command -v agent-state >/dev/null 2>&1 || exit 0
command -v jq >/dev/null 2>&1 || exit 0

declare -A LOC
if command -v tmux >/dev/null 2>&1; then
  while IFS=$'\t' read -r pid wi pi _; do
    [[ -n "$pid" ]] && LOC[$pid]="$wi.$pi"
  done < <(tmux list-panes -a -F '#{pane_id}	#{window_index}	#{pane_index}	#{session_name}' 2>/dev/null || true)
fi

agent-state --all --json 2>/dev/null \
  | jq -r '.[] | select(.state == "idle" or (.state | startswith("blocked:"))) | [.pane, .agent, .state, .name] | @tsv' \
  | while IFS=$'\t' read -r pane agent state name; do
      loc="${LOC[$pane]:-?.?}"
      printf '%s\t%s\t%s\t%s\t%s\n' "$pane" "$agent" "$state" "$name" "$loc"
    done
