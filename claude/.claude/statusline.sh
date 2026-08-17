#!/bin/bash

input=$(cat)

# Fallback colors, used only when starship.toml is unreadable
F_OS='\033[97m'
F_DIR='\033[97m'
F_ROOT='\033[1;36m'
F_BRANCH='\033[92m'
F_AHEAD='\033[32m'
F_BEHIND='\033[93m'
F_UNTRACKED='\033[93m'
F_MODIFIED='\033[93m'
F_CONFLICT='\033[91m'
DIM='\033[2m'
RESET='\033[0m'
CLEAR='\033[K' # clear to end of line

# Theme colors come from the active starship theme (a theme-set-managed
# symlink), so the statusline tracks theme switches automatically. Hosts
# without theme-set fall back to the theme copy shipped next to this script.
STARSHIP="${STARSHIP_CONFIG:-$HOME/.config/starship.toml}"
[ -r "$STARSHIP" ] || STARSHIP="${BASH_SOURCE[0]%/*}/statusline-theme.toml"

# [os.symbols] key for this host, so the OS glyph comes from the theme
# instead of being pinned to one platform.
os_key=Linux
case "$(uname -s)" in
  Darwin) os_key=Macos ;;
  Linux)
    case "$(. /etc/os-release 2>/dev/null && echo "$ID")" in
      ubuntu) os_key=Ubuntu ;;
      arch) os_key=Arch ;;
      linuxmint) os_key=Mint ;;
    esac
    ;;
esac

if [ -r "$STARSHIP" ]; then
  IFS=$'\t' read -r t_os t_dir t_root t_branch t_ahead t_behind t_untracked t_modified t_conflict t_ossym < <(
    awk -v oskey="$os_key" '
      function grab(l, h) {
        if (match(l, /#[0-9a-fA-F]{6}/)) {
          h = substr(l, RSTART, RLENGTH)
          return (l ~ /bold/) ? "bold" h : h
        }
        return "-"
      }
      function grabsym(l) {
        if (match(l, /"[^"]*"/)) return substr(l, RSTART + 1, RLENGTH - 2)
        return "-"
      }
      /^\[/ { s = $0 }
      s == "[os]" && /^style/ { os = grab($0) }
      s == "[os.symbols]" && $1 == oskey { sym = grabsym($0) }
      s == "[directory]" && /^style/ { dir = grab($0) }
      s == "[directory]" && /^repo_root_style/ { root = grab($0) }
      s == "[git_branch]" && /^style/ { br = grab($0) }
      s == "[git_status]" && /^ahead/ { ah = grab($0) }
      s == "[git_status]" && /^behind/ { bh = grab($0) }
      s == "[git_status]" && /^untracked/ { un = grab($0) }
      s == "[git_status]" && /^modified/ { mo = grab($0) }
      s == "[git_status]" && /^conflicted/ { co = grab($0) }
      END {
        printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
          os ? os : "-", dir ? dir : "-", root ? root : "-",
          br ? br : "-", ah ? ah : "-", bh ? bh : "-",
          un ? un : "-", mo ? mo : "-", co ? co : "-",
          sym ? sym : "-"
      }
    ' "$STARSHIP"
  )
fi

# c <var> <themed-spec> <fallback>: set var to truecolor escape for
# "#rrggbb" / "bold#rrggbb", or to the fallback when the theme lacks it
c() {
  local spec=$2 bold=""
  if [ -n "$spec" ] && [ "$spec" != "-" ]; then
    case "$spec" in bold*) bold="1;" ;; esac
    local h=${spec##*#}
    printf -v "$1" '\033[%s38;2;%d;%d;%dm' "$bold" \
      "$((16#${h:0:2}))" "$((16#${h:2:2}))" "$((16#${h:4:2}))"
  else
    printf -v "$1" '%s' "$3"
  fi
}

# OS glyph from the theme, else the platform default (Apple / Linux)
OS_GLYPH=$t_ossym
if [ -z "$OS_GLYPH" ] || [ "$OS_GLYPH" = "-" ]; then
  case "$os_key" in
    Macos) printf -v OS_GLYPH '\xf3\xb0\x80\xb5 ' ;;
    *) printf -v OS_GLYPH '\xee\xaf\x86 ' ;;
  esac
fi

c C_OS "$t_os" "$F_OS"
c C_DIR "$t_dir" "$F_DIR"
c C_ROOT "$t_root" "$F_ROOT"
c C_BRANCH "$t_branch" "$F_BRANCH"
c C_AHEAD "$t_ahead" "$F_AHEAD"
c C_BEHIND "$t_behind" "$F_BEHIND"
c C_UNTRACKED "$t_untracked" "$F_UNTRACKED"
c C_MODIFIED "$t_modified" "$F_MODIFIED"
c C_CONFLICT "$t_conflict" "$F_CONFLICT"

# Extract all JSON fields in one jq call. Every field must be non-empty:
# read collapses runs of tabs, so an empty field would shift the rest left.
IFS=$'\t' read -r dir model effort duration_ms used_pct ctx_tokens < <(
  jq -r '[
    (.workspace.current_dir // "."),
    (.model.display_name // .model.id // "unknown"),
    (.effort.level // "-"),
    (.cost.total_duration_ms // 0),
    (.context_window.used_percentage // 0),
    (.context_window.current_usage
      | if . == null then 0
        else (.input_tokens + .cache_creation_input_tokens + .cache_read_input_tokens)
        end)
  ] | @tsv' <<<"$input"
)
dir_name=$(basename "$dir")

# Starship's modified (U+EA71) / conflicted (U+EBAB) glyphs as UTF-8 bytes
printf -v G_MODIFIED '\xee\xa9\xb1'
printf -v G_CONFLICT '\xee\xae\xab'

# Git info in one process: branch, ahead/behind, changes, conflicts, untracked
branch="" ahead="" behind="" untracked="" modified="" conflict=""
if git_status=$(git -C "$dir" status --porcelain=v2 --branch 2>/dev/null); then
  while IFS= read -r line; do
    case "$line" in
      "# branch.head "*) branch="${line#\# branch.head }" ;;
      "# branch.ab "*)
        ab="${line#\# branch.ab }" # e.g. "+2 -1"
        ahead_count="${ab%% *}" behind_count="${ab##* }"
        [ "${ahead_count#+}" -gt 0 ] 2>/dev/null && ahead="⇡${ahead_count#+}"
        [ "${behind_count#-}" -gt 0 ] 2>/dev/null && behind="⇣${behind_count#-}"
        ;;
      "? "*) untracked="?" ;;
      "u "*) conflict=$G_CONFLICT ;;
      "1 "* | "2 "*) modified=$G_MODIFIED ;;
    esac
  done <<<"$git_status"
  if [ "$branch" = "(detached)" ]; then
    branch="@$(git -C "$dir" rev-parse --short HEAD 2>/dev/null)"
  fi
fi

# Context pressure: theme green, behind-yellow >=70, conflict-red >=90
ctx_color=$DIM
used=${used_pct%%.*}
[ "$used" -ge 70 ] 2>/dev/null && ctx_color=$C_BEHIND
[ "$used" -ge 90 ] 2>/dev/null && ctx_color=$C_CONFLICT

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

# Format tokens (19500 -> 19.5k, 1200000 -> 1.2M)
format_tokens() {
  local tokens=$1
  if [ "$tokens" -ge 1000000 ] 2>/dev/null; then
    awk -v t="$tokens" 'BEGIN {printf "%.1fM", t/1000000}'
  elif [ "$tokens" -ge 1000 ] 2>/dev/null; then
    awk -v t="$tokens" 'BEGIN {printf "%.1fk", t/1000}'
  else
    echo "$tokens"
  fi
}

# BUILD SINGLE LINE (captain footer grammar):
# Model · effort · …/dir branch <git flags>            <right: 183k (67%)>
line="${C_OS}${model}${RESET}"
[ -n "$effort" ] && [ "$effort" != "-" ] && line+="${DIM} · ${effort}${RESET}"
line+="${DIM} · ${RESET}${C_DIR}…/${C_ROOT}${dir_name}${RESET}"
[ -n "$branch" ] && line+=" ${C_BRANCH}${branch}${RESET}"
[ -n "$conflict" ] && line+=" ${C_CONFLICT}${conflict}${RESET}"
[ -n "$modified" ] && line+=" ${C_MODIFIED}${modified}${RESET}"
[ -n "$untracked" ] && line+=" ${C_UNTRACKED}${untracked}${RESET}"
if [ -n "$ahead" ] && [ -n "$behind" ]; then
  line+=" ${C_BEHIND}⇕${ahead}${behind}${RESET}"
else
  [ -n "$ahead" ] && line+=" ${C_AHEAD}${ahead}${RESET}"
  [ -n "$behind" ] && line+=" ${C_BEHIND}${behind}${RESET}"
fi

# Right block: 183k (67%), right-aligned when the terminal width is knowable
right=""
if [ -n "$ctx_tokens" ] && [ "$ctx_tokens" != "0" ] && [ "$ctx_tokens" != "null" ]; then
  right="${C_OS}$(format_tokens "$ctx_tokens")${RESET}"
  [ "$used" -gt 0 ] 2>/dev/null && right+=" ${ctx_color}(${used}%)${RESET}"
elif [ "$used" -gt 0 ] 2>/dev/null; then
  right="${ctx_color}${used}%${RESET}"
fi

if [ -n "$right" ]; then
  cols=${COLUMNS:-}
  strip() { printf '%s' "$1" | sed -e $'s/\x1b\[[0-9;]*m//g' -e 's/\\033\[[0-9;]*m//g'; }
  lv=$(strip "$line"); rv=$(strip "$right")
  pad=0
  [ -n "$cols" ] && pad=$((cols - ${#lv} - ${#rv} - 3))
  if [ "$pad" -gt 0 ] 2>/dev/null; then
    line+="$(printf '%*s' "$pad" '')${right}"
  else
    line+="${DIM} · ${RESET}${right}"
  fi
fi

# Output one line (CLEAR ensures no leftover characters from previous renders)
printf '%b%b' "$line" "$CLEAR"
