#!/bin/bash
# Notify when Claude Code finishes inside tmux.
# Outside tmux, Claude Code's built-in idle notification handles this
# natively after 60 seconds with proper terminal focus detection.

# Debug: log each invocation with stdin JSON
INPUT=$(cat)
echo "$(date '+%H:%M:%S') hook fired (TMUX_PANE=$TMUX_PANE) input=$INPUT" >> /tmp/tmux-notify-debug.log

[ -z "$TMUX_PANE" ] && exit 0

info=$(tmux display-message -t "$TMUX_PANE" -p '#{window_active}'$'\t''#{session_name} #{window_index}:#{window_name}' 2>/dev/null)
is_active=$(printf '%s' "$info" | cut -f1)
window=$(printf '%s' "$info" | cut -f2)

if [ "$is_active" != "1" ]; then
  message=$(printf '%s' "$INPUT" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
  [ -z "$message" ] && message="Waiting for input"
  project=$(basename "$PWD" 2>/dev/null)
  body="$message in $window"
  [ -n "$project" ] && body="$body — $project"
  osascript -e "display notification \"$body\" with title \"Claude Code\" sound name \"default\""
fi
