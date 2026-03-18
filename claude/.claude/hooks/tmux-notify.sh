#!/bin/bash
# Notify when Claude Code finishes inside tmux.
# Outside tmux, Claude Code's built-in idle notification handles this
# natively after 60 seconds with proper terminal focus detection.

INPUT=$(cat)

[ -z "$TMUX_PANE" ] && exit 0

info=$(tmux display-message -t "$TMUX_PANE" -p '#{window_active}'$'\t''#{window_index}' 2>/dev/null)
is_active=$(printf '%s' "$info" | cut -f1)
win_idx=$(printf '%s' "$info" | cut -f2)

if [ "$is_active" != "1" ]; then
  message=$(printf '%s' "$INPUT" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
  [ -z "$message" ] && message="Waiting for input"
  project=$(basename "$PWD" 2>/dev/null)

  title="Claude Code"
  subtitle="#$win_idx › $project"

  osascript -e "display notification \"$message\" with title \"$title\" subtitle \"$subtitle\" sound name \"default\""
fi
