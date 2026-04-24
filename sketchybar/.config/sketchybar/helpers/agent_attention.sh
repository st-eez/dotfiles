#!/usr/bin/env bash
# Emit one TSV row per agent pane, including working.
# Columns: pane_id<TAB>agent<TAB>state<TAB>name<TAB>loc<TAB>session_id
#   loc        = "session:window.pane" — falls back to "?:?.?" when tmux has no
#                match for the pane (agent-state knows about a pane tmux has
#                since dropped, or tmux is unreachable).
#   session_id = agent session UUID from `agent-state --json`'s detail.session_id
#                (empty string when the agent did not report one). Lets popup
#                rows be traced back to Ren/Codex session logs.
set -euo pipefail

# sketchybar's launchd env omits ~/.local/bin and ~/.steez/bin on PATH, and has
# no locale set.
# Without UTF-8 locale, tmux -F $'\t' emits `_` instead of tab — agent-state's
# internal parsing then treats every pane as unknown and returns [].
export PATH="$HOME/.steez/bin:$HOME/.local/bin:$PATH"
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

command -v agent-state >/dev/null 2>&1 || exit 0
command -v jq >/dev/null 2>&1 || exit 0
command -v awk >/dev/null 2>&1 || exit 0

{
  if command -v tmux >/dev/null 2>&1; then
    tmux list-panes -a -F '#{pane_id}	#{session_name}	#{window_index}	#{pane_index}' 2>/dev/null \
      | awk 'BEGIN { FS = OFS = "\t" } { print "L", $1, $2 ":" $3 "." $4 }' \
      || true
  fi

  agent-state --all --json 2>/dev/null \
    | jq -r '.[] | [.pane, .agent, .state, .name, (.detail.session_id // "")] | @tsv' \
    | awk 'BEGIN { FS = OFS = "\t" } { print "A", $0 }'
} | awk '
  BEGIN { FS = OFS = "\t" }
  $1 == "L" {
    loc[$2] = $3
    next
  }
  $1 == "A" {
    pane = $2
    print $2, $3, $4, $5, ((pane in loc) ? loc[pane] : "?:?.?"), $6
  }
'
