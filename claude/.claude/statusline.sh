#!/bin/bash

input=$(cat)

# Colors (matching starship.toml)
WHITE='\033[97m'       # bright-white: OS icon
BOLD_CYAN='\033[1;36m' # bold cyan: directory name
GREEN='\033[92m'       # bright-green: git branch
STD_GREEN='\033[32m'   # green: commits ahead
CYAN='\033[96m'        # bright-cyan: tokens
YELLOW='\033[93m'      # bright-yellow: git warnings
RED='\033[91m'         # red: deletions, context <20%
DIM='\033[2m'          # dim: separators
RESET='\033[0m'
CLEAR='\033[K'         # clear to end of line

# Extract JSON data
dir=$(echo "$input" | jq -r '.workspace.current_dir // "."')
dir_name=$(basename "$dir")
model=$(echo "$input" | jq -r '.model.display_name // .model.id // "unknown"')
duration_ms=$(echo "$input" | jq -r '.cost.total_duration_ms // 0')
total_input=$(echo "$input" | jq -r '.context_window.total_input_tokens // 0')
total_output=$(echo "$input" | jq -r '.context_window.total_output_tokens // 0')

# Git info
branch=""
ahead=""
behind=""
untracked=""
modified=""

if cd "$dir" 2>/dev/null && git rev-parse --git-dir &>/dev/null; then
  branch=$(git symbolic-ref --short HEAD 2>/dev/null)

  # Ahead/behind
  tracking=$(git for-each-ref --format='%(upstream:short)' "$(git symbolic-ref -q HEAD)" 2>/dev/null)
  if [ -n "$tracking" ]; then
    counts=$(git rev-list --left-right --count HEAD..."$tracking" 2>/dev/null)
    ahead_count=$(echo "$counts" | cut -f1)
    behind_count=$(echo "$counts" | cut -f2)
    [ "$ahead_count" -gt 0 ] 2>/dev/null && ahead="⇡${ahead_count}"
    [ "$behind_count" -gt 0 ] 2>/dev/null && behind="⇣${behind_count}"
  fi

  # Status indicators
  [ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ] && untracked="?"
  git diff --quiet 2>/dev/null || modified="●"
fi

# Context window percentage (using new pre-calculated field)
ctx=""
used=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)

if [ "$used" -gt 0 ] 2>/dev/null; then
  ctx="${used}%"
fi

# Format duration (minutes only)
session_time=""
if [ "$duration_ms" != "0" ] && [ "$duration_ms" != "null" ]; then
  total_sec=$((duration_ms / 1000))
  hours=$((total_sec / 3600))
  minutes=$(((total_sec % 3600) / 60))
  if [ "$hours" -gt 0 ]; then
    session_time="${hours}h ${minutes}m"
  elif [ "$minutes" -gt 0 ]; then
    session_time="${minutes}m"
  fi
fi

# Format tokens (19500 -> 19.5k)
format_tokens() {
  local tokens=$1
  if [ "$tokens" -ge 1000 ] 2>/dev/null; then
    awk -v t="$tokens" 'BEGIN {printf "%.1fk", t/1000}'
  else
    echo "$tokens"
  fi
}
input_fmt=$(format_tokens "$total_input")
output_fmt=$(format_tokens "$total_output")

# BUILD LINE 1: 󰀵 …/dir  branch ⇡2 ⇣1 ? ●
line1=$(printf "${WHITE}󰀵 ${BOLD_CYAN}…/%s${RESET}" "$dir_name")

if [ -n "$branch" ]; then
  line1="$line1 $(printf "${GREEN} %s${RESET}" "$branch")"
fi

[ -n "$ahead" ] && line1="$line1 $(printf "${STD_GREEN}%s${RESET}" "$ahead")"
[ -n "$behind" ] && line1="$line1 $(printf "${YELLOW}%s${RESET}" "$behind")"
[ -n "$modified" ] && line1="$line1 $(printf "${YELLOW}%s${RESET}" "$modified")"
[ -n "$untracked" ] && line1="$line1 $(printf "${YELLOW}%s${RESET}" "$untracked")"

# BUILD LINE 2: model │ duration │ ctx% │ tokens (all dim/grey)
line2=$(printf "${DIM}%s" "$model")

if [ -n "$session_time" ]; then
  line2="$line2 $(printf "│ %s" "$session_time")"
fi

if [ -n "$ctx" ]; then
  line2="$line2 $(printf "│ %s used" "$ctx")"
fi

if [ "$total_input" != "0" ] || [ "$total_output" != "0" ]; then
  line2="$line2 $(printf "│ ↓%s in / ↑%s out" "$input_fmt" "$output_fmt")"
fi

line2="${line2}${RESET}"

# Output both lines (CLEAR ensures no leftover characters from previous renders)
printf '%b%b\n%b%b' "$line1" "$CLEAR" "$line2" "$CLEAR"
