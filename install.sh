#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Steez Dotfiles Installer
# ═══════════════════════════════════════════════════════════════════════════════
# Description: Interactive installer for steez dotfiles using GNU Stow
# Author:      Steve Dimakos
# Repository:  https://github.com/stevedimakos/dotfiles
# License:     MIT
# ═══════════════════════════════════════════════════════════════════════════════

set -uo pipefail
# Note: -e disabled because it interferes with interactive menu navigation

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="2.0.0"

# Package Groups (Stowed: has a folder in repo)
readonly MACOS_PKGS=(aerospace autoraise bitwarden borders karabiner localsend raycast sketchybar pnpm)
readonly TERMINAL_PKGS=(btop claude codex eza fd fzf gemini gh ghostty git lazygit lua nmap nvim node prettier ripgrep stow telnet wireguard-tools zoxide zsh)
readonly GIT_PKGS=()

# Brew-only (installed via Brewfile, no config folder to stow)
readonly BREW_ONLY_PKGS=()

# Brew mappings: stow package → brew install command
declare -A PKG_BREW_MAP=(
  [aerospace]="--cask aerospace"
  [autoraise]="--cask autoraiseapp"
  [bitwarden]="--cask bitwarden"
  [borders]="borders"
  [ghostty]="--cask ghostty"
  [karabiner]="--cask karabiner-elements"
  [localsend]="--cask localsend"
  [nvim]="neovim"
  [raycast]="--cask raycast"
  [sketchybar]="sketchybar"
  [claude]="claude-code"
  [codex]="codex"
  [gemini]="gemini-cli"
  [btop]="btop"
  [eza]="eza"
  [fd]="fd"
  [fzf]="fzf"
  [gh]="gh"
  [git]="git"
  [lazygit]="lazygit"
  [ripgrep]="ripgrep"
  [zoxide]="zoxide"
  [node]="node"
  [pnpm]="pnpm"
  [prettier]="prettier"
  [lua]="lua"
  [stow]="stow"
  [nmap]="nmap"
  [telnet]="telnet"
  [wireguard-tools]="wireguard-tools"
)

# Pacman mappings: stow package → pacman/AUR package name
# Packages prefixed with "aur:" require an AUR helper (yay/paru)
declare -A PKG_PACMAN_MAP=(
  [nvim]="neovim"
  [btop]="btop"
  [eza]="eza"
  [fd]="fd"
  [fzf]="fzf"
  [gh]="github-cli"
  [git]="git"
  [lazygit]="lazygit"
  [ripgrep]="ripgrep"
  [zoxide]="zoxide"
  [node]="nodejs"
  [pnpm]="pnpm"
  [prettier]="prettier"
  [lua]="lua"
  [stow]="stow"
  [nmap]="nmap"
  [telnet]="inetutils"
  [wireguard-tools]="wireguard-tools"
  [ghostty]="aur:ghostty"
  [claude]="aur:claude-code-bin"
  [codex]="aur:codex"
  [gemini]="aur:gemini-cli"
)

# ─────────────────────────────────────────────────────────────────────────────
# Terminal Control & Colors (TokyoNight Palette)
# ─────────────────────────────────────────────────────────────────────────────

# Check for Truecolor support
if [[ "${COLORTERM:-}" == "truecolor" || "${COLORTERM:-}" == "24bit" ]]; then
  readonly TC_SUPPORT=true
else
  readonly TC_SUPPORT=false
fi

# TokyoNight Colors
if [[ "$TC_SUPPORT" == true ]]; then
  readonly TN_BLUE=$'\e[38;2;122;162;247m'
  readonly TN_MAGENTA=$'\e[38;2;187;154;247m'
  readonly TN_CYAN=$'\e[38;2;125;207;255m'
  readonly TN_GREEN=$'\e[38;2;158;206;106m'
  readonly TN_YELLOW=$'\e[38;2;224;175;104m'
  readonly TN_RED=$'\e[38;2;247;118;142m'
  readonly TN_ORANGE=$'\e[38;2;255;158;100m'
  readonly TN_FG=$'\e[38;2;192;202;245m'
  readonly TN_DIM=$'\e[38;2;86;95;137m'
  readonly TN_BG=$'\e[48;2;26;27;38m'
  readonly TN_SEL=$'\e[48;2;41;46;66m'
else
  readonly TN_BLUE=$'\e[0;34m'
  readonly TN_MAGENTA=$'\e[0;35m'
  readonly TN_CYAN=$'\e[0;36m'
  readonly TN_GREEN=$'\e[0;32m'
  readonly TN_YELLOW=$'\e[0;33m'
  readonly TN_RED=$'\e[0;31m'
  readonly TN_ORANGE=$'\e[0;33m'
  readonly TN_FG=$'\e[0;37m'
  readonly TN_DIM=$'\e[2m'
  readonly TN_BG=""
  readonly TN_SEL=$'\e[7m'
fi

# Fallback Colors (standard ANSI)
readonly RED=$'\e[0;31m'
readonly GREEN=$'\e[0;32m'
readonly YELLOW=$'\e[0;33m'
readonly BLUE=$'\e[0;34m'
readonly MAGENTA=$'\e[0;35m'
readonly CYAN=$'\e[0;36m'
readonly WHITE=$'\e[0;37m'
readonly BOLD=$'\e[1m'
readonly DIM=$'\e[2m'
readonly NC=$'\e[0m'

# Semantic Colors
readonly C_PRIMARY="${TN_BLUE}"
readonly C_SECONDARY="${TN_MAGENTA}"
readonly C_SUCCESS="${TN_GREEN}"
readonly C_WARNING="${TN_YELLOW}"
readonly C_ERROR="${TN_RED}"
readonly C_INFO="${TN_CYAN}"
readonly C_DIM="${TN_DIM}"
readonly C_BOLD="${BOLD}${TN_FG}"

# UI Characters
readonly CHECK="✔"
readonly CROSS="✘"
readonly ARROW="❯"
readonly BULLET="•"
readonly POINTER="➜"
readonly RADIO_ON="◉"
readonly RADIO_OFF="○"
readonly CHECK_ON="▣"
readonly CHECK_OFF="▢"

# Box Drawing
readonly B_TL="╭"
readonly B_TR="╮"
readonly B_BL="╰"
readonly B_BR="╯"
readonly B_H="─"
readonly B_V="│"

# Cursor control
readonly CURSOR_UP=$'\e[1A'
readonly CLEAR_LINE=$'\e[2K'
readonly HIDE_CURSOR=$'\e[?25l'
readonly SHOW_CURSOR=$'\e[?25h'
readonly SAVE_CURSOR=$'\e[s'
readonly RESTORE_CURSOR=$'\e[u'

# ─────────────────────────────────────────────────────────────────────────────
# Global State
# ─────────────────────────────────────────────────────────────────────────────

OS=""
SELECTED_PKGS=()
CURSOR_VISIBLE=true

# ─────────────────────────────────────────────────────────────────────────────
# Cleanup & Signal Handling
# ─────────────────────────────────────────────────────────────────────────────

cleanup() {
  tput cnorm 2>/dev/null || printf "${SHOW_CURSOR}"
  stty echo 2>/dev/null || true
}

trap cleanup EXIT INT TERM

# ─────────────────────────────────────────────────────────────────────────────
# UI Components
# ─────────────────────────────────────────────────────────────────────────────

# Gradient helper: interpolate between two colors
# Usage: gradient_text "text" "R1;G1;B1" "R2;G2;B2"
gradient_text() {
  local text="$1"
  local start="$2"
  local end="$3"
  local len=${#text}
  
  if [[ "$TC_SUPPORT" != true ]]; then
    printf "%s" "$text"
    return
  fi
  
  IFS=';' read -r r1 g1 b1 <<< "$start"
  IFS=';' read -r r2 g2 b2 <<< "$end"
  
  for ((i=0; i<len; i++)); do
    local r=$((r1 + (r2 - r1) * i / len))
    local g=$((g1 + (g2 - g1) * i / len))
    local b=$((b1 + (b2 - b1) * i / len))
    printf "\e[38;2;%d;%d;%dm%s" "$r" "$g" "$b" "${text:$i:1}"
  done
  printf "${NC}"
}

print_banner() {
  local line1="   ███████╗████████╗███████╗███████╗███████╗"
  local line2="   ██╔════╝╚══██╔══╝██╔════╝██╔════╝╚══███╔╝"
  local line3="   ███████╗   ██║   █████╗  █████╗    ███╔╝ "
  local line4="   ╚════██║   ██║   ██╔══╝  ██╔══╝   ███╔╝  "
  local line5="   ███████║   ██║   ███████╗███████╗███████╗"
  local line6="   ╚══════╝   ╚═╝   ╚══════╝╚══════╝╚══════╝"

  echo ""
  gradient_text "$line1" "122;162;247" "187;154;247"; echo ""
  gradient_text "$line2" "122;162;247" "187;154;247"; echo ""
  gradient_text "$line3" "122;162;247" "187;154;247"; echo ""
  gradient_text "$line4" "122;162;247" "187;154;247"; echo ""
  gradient_text "$line5" "122;162;247" "187;154;247"; echo ""
  gradient_text "$line6" "122;162;247" "187;154;247"; echo ""
  
  printf "\n      ${C_DIM}modern dotfiles installer ${C_BOLD}v${VERSION}${NC}\n"
  printf "      ${C_DIM}─────────────────────────────────────────${NC}\n\n"
}

show_sysinfo() {
  local os_name=$(uname -s)
  local host_name=$(hostname -s)
  local shell_name=$(basename "$SHELL")
  local uptime_info=$(uptime | awk -F'( |,|:)+' '{print $6,$7}')
  
  printf "  ${C_PRIMARY}${B_TL}"
  for i in {1..48}; do printf "${B_H}"; done
  printf "${B_TR}${NC}\n"
  
  printf "  ${C_PRIMARY}${B_V}${NC}  ${C_PRIMARY}󰌢 ${C_BOLD}%-11s${NC} ${C_SECONDARY}󰅐 ${C_BOLD}%-11s${NC} ${C_INFO}󰆍 ${C_BOLD}%-11s${NC}  ${C_PRIMARY}${B_V}${NC}\n" \
    "$host_name" "$uptime_info" "$shell_name"
    
  printf "  ${C_PRIMARY}${B_BL}"
  for i in {1..48}; do printf "${B_H}"; done
  printf "${B_BR}${NC}\n"
}

# ─────────────────────────────────────────────────────────────────────────────
# Print Helpers
# ─────────────────────────────────────────────────────────────────────────────

print_section() {
  local title="$1"
  echo ""
  printf "  "
  gradient_text "󰘧 $title" "122;162;247" "187;154;247"
  printf "\n  ${C_DIM}"
  for i in {1..40}; do printf "─"; done
  printf "${NC}\n"
}

print_success() {
  printf "  ${C_SUCCESS}${CHECK}${NC} %s\n" "$1"
}

print_error() {
  printf "  ${C_ERROR}${CROSS}${NC} %s\n" "$1"
}

print_info() {
  printf "  ${C_INFO}${ARROW}${NC} %s\n" "$1"
}

print_warning() {
  printf "  ${C_WARNING}!${NC} %s\n" "$1"
}

print_item() {
  echo -e "    ${C_DIM}${BULLET}${NC} $1"
}

print_dim() {
  printf "  ${C_DIM}%s${NC}\n" "$1"
}

# ─────────────────────────────────────────────────────────────────────────────
# Animation & Progress
# ─────────────────────────────────────────────────────────────────────────────

# Spinner for background tasks
# Usage: spin_task "Message" "command"
spin_task() {
  local msg="$1"
  local cmd="$2"
  local frames=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
  local spin_pid
  
  # Start command in background
  eval "$cmd" > /dev/null 2>&1 &
  spin_pid=$!
  
  tput civis # hide cursor
  
  while kill -0 "$spin_pid" 2>/dev/null; do
    for frame in "${frames[@]}"; do
      printf "\r  ${C_PRIMARY}%s${NC} %s" "$frame" "$msg"
      sleep 0.1
    done
  done
  
  wait "$spin_pid"
  local exit_code=$?
  
  printf "\r${CLEAR_LINE}"
  if [ $exit_code -eq 0 ]; then
    print_success "$msg"
  else
    print_error "$msg (failed)"
  fi
  
  tput cnorm # show cursor
  return $exit_code
}

# Modern Progress Bar
# Usage: draw_progress current total
draw_progress() {
  local current="$1"
  local total="$2"
  local width=30
  local percent=$((current * 100 / total))
  local filled=$((current * width / total))
  local empty=$((width - filled))
  
  printf "\r  ${C_DIM}Progress: ["
  printf "${C_SUCCESS}"
  for ((i=0; i<filled; i++)); do printf "━"; done
  printf "${C_DIM}"
  for ((i=0; i<empty; i++)); do printf "─"; done
  printf "${C_DIM}] ${C_BOLD}%3d%%${NC}" "$percent"
}

# ─────────────────────────────────────────────────────────────────────────────
# Input Helpers
# ─────────────────────────────────────────────────────────────────────────────

# Global for key reading (avoids subshell issues)
KEY_PRESSED=""

# Read a single keypress (handles arrow keys)
# Sets KEY_PRESSED global variable
read_key() {
  KEY_PRESSED=""

  # Save terminal settings and disable echo
  local saved_tty
  saved_tty=$(stty -g)
  stty -echo -icanon min 1 time 0

  local char
  char=$(dd bs=1 count=1 2>/dev/null)

  # Handle escape sequences (arrow keys)
  if [[ "$char" == $'\x1b' ]]; then
    # Brief wait for rest of escape sequence
    stty min 0 time 1
    local seq
    seq=$(dd bs=2 count=1 2>/dev/null)
    case "$seq" in
      '[A') KEY_PRESSED="UP" ;;
      '[B') KEY_PRESSED="DOWN" ;;
      '[C') KEY_PRESSED="RIGHT" ;;
      '[D') KEY_PRESSED="LEFT" ;;
      *) KEY_PRESSED="ESC" ;;
    esac
  elif [[ "$char" == "" ]]; then
    KEY_PRESSED="ENTER"
  else
    KEY_PRESSED="$char"
  fi

  # Restore terminal settings
  stty "$saved_tty"
}

# ─────────────────────────────────────────────────────────────────────────────
# Menu System - Unified Arrow-Key Navigation
# ─────────────────────────────────────────────────────────────────────────────

# Single-select menu (radio buttons)
# Usage: menu_select "Title" "option1|desc1" "option2|desc2" ...
# Returns: Selected index (0-based) in $MENU_RESULT
MENU_RESULT=""

_draw_select_menu() {
  local title="$1"
  local cursor="$2"
  shift 2
  local options=("$@")
  local count=${#options[@]}

  printf "  "
  gradient_text "󰮫 $title" "122;162;247" "187;154;247"
  printf "\n  ${C_DIM}↑/↓ navigate • enter select • q quit${NC}\n\n"

  for ((i=0; i<count; i++)); do
    local opt="${options[$i]}"
    local label="${opt%%|*}"
    local desc="${opt#*|}"
    [[ "$desc" == "$opt" ]] && desc=""

    if [[ $i -eq $cursor ]]; then
      printf "  ${C_PRIMARY}┃${NC} ${C_BOLD}${TN_BLUE}${POINTER}${NC} ${C_BOLD}%-15s${NC} ${C_INFO}%s${NC}\e[K\n" "$label" "$desc"
    else
      printf "  ${C_DIM}│   ${RADIO_OFF}${NC} %-15s ${C_DIM}%s${NC}\e[K\n" "$label" "$desc"
    fi
  done
  echo ""
}

menu_select() {
  local title="$1"
  shift
  local options=("$@")
  local count=${#options[@]}
  local cursor=0
  local menu_lines=$((count + 4)) # title + help + empty + options + bottom

  tput civis  # hide cursor
  CURSOR_VISIBLE=false
  echo ""

  # Initial draw
  _draw_select_menu "$title" "$cursor" "${options[@]}"

  # Selection loop
  while true; do
    read_key

    local old_cursor=$cursor
    case "$KEY_PRESSED" in
      UP|k) ((cursor > 0)) && ((cursor--)) ;;
      DOWN|j) ((cursor < count-1)) && ((cursor++)) ;;
      ENTER)
        tput cnorm  # show cursor
        CURSOR_VISIBLE=true
        echo ""
        MENU_RESULT=$cursor
        return 0
        ;;
      q|Q|ESC)
        tput cnorm  # show cursor
        CURSOR_VISIBLE=true
        echo ""
        MENU_RESULT=-1
        return 1
        ;;
    esac

    # Only redraw if cursor changed
    if [[ $cursor -ne $old_cursor ]]; then
      tput cuu "$menu_lines"  # move up
      _draw_select_menu "$title" "$cursor" "${options[@]}"
    fi
  done
}

# Multi-select menu (checkboxes)
# Usage: menu_multiselect "Title" "group1:opt1" "group1:opt2" "group2:opt3" ...
# Returns: Space-separated selected items in $MENU_RESULT
menu_multiselect() {
  local title="$1"
  shift
  local items=("$@")
  local count=${#items[@]}
  local cursor=0
  local -a selected=()
  local -a groups=()
  local -a labels=()

  # Parse items and initialize
  for ((i=0; i<count; i++)); do
    local item="${items[$i]}"
    groups+=("${item%%:*}")
    labels+=("${item#*:}")
    selected+=(0)
  done

  # Count unique groups for line calculation
  local prev_group=""
  local group_count=0
  for g in "${groups[@]}"; do
    [[ "$g" != "$prev_group" ]] && ((group_count++))
    prev_group="$g"
  done

  # Calculate lines: title + help + empty + groups + items + extra spacing
  local menu_lines=$((5 + group_count + count))

  tput civis  # hide cursor
  CURSOR_VISIBLE=false
  echo ""

  # Initial draw
  _draw_multiselect "$title" labels groups selected $cursor

  # Selection loop
  while true; do
    read_key

    local needs_redraw=false
    local old_cursor=$cursor

    case "$KEY_PRESSED" in
      UP|k)
        if ((cursor > 0)); then
          ((cursor--))
          needs_redraw=true
        fi
        ;;
      DOWN|j)
        if ((cursor < count-1)); then
          ((cursor++))
          needs_redraw=true
        fi
        ;;
      ' ')
        if [[ ${selected[$cursor]} -eq 0 ]]; then
          selected[$cursor]=1
        else
          selected[$cursor]=0
        fi
        needs_redraw=true
        ;;
      a|A)
        for ((i=0; i<count; i++)); do
          selected[$i]=1
        done
        needs_redraw=true
        ;;
      n|N)
        for ((i=0; i<count; i++)); do
          selected[$i]=0
        done
        needs_redraw=true
        ;;
      ENTER)
        # Check if at least one item is selected
        local has_selection=false
        for ((i=0; i<count; i++)); do
          if [[ ${selected[$i]} -eq 1 ]]; then
            has_selection=true
            break
          fi
        done

        if [[ "$has_selection" == false ]]; then
          continue
        fi

        tput cnorm
        CURSOR_VISIBLE=true
        echo ""

        MENU_RESULT=""
        for ((i=0; i<count; i++)); do
          if [[ ${selected[$i]} -eq 1 ]]; then
            MENU_RESULT+="${labels[$i]} "
          fi
        done
        MENU_RESULT="${MENU_RESULT% }"
        return 0
        ;;
      q|Q|ESC)
        tput cnorm
        CURSOR_VISIBLE=true
        echo ""
        MENU_RESULT=""
        return 1
        ;;
    esac

    # Only redraw if something changed
    if [[ "$needs_redraw" == true ]]; then
      tput cuu "$menu_lines"
      _draw_multiselect "$title" labels groups selected $cursor
    fi
  done
}

_draw_multiselect() {
  local title="$1"
  local -n _labels=$2
  local -n _groups=$3
  local -n _selected=$4
  local cursor=$5

  local count=${#_labels[@]}

  printf "  "
  gradient_text "󱒦 $title" "122;162;247" "187;154;247"
  printf "\n  ${C_DIM}↑/↓ move • space toggle • a all • n none • enter confirm${NC}\n"

  local current_group=""
  for ((i=0; i<count; i++)); do
    local group="${_groups[$i]}"
    local label="${_labels[$i]}"

    # Group header
    if [[ "$group" != "$current_group" ]]; then
      printf "\n    ${C_SECONDARY}${BOLD}%s${NC}\n" "$group"
      current_group="$group"
    fi

    # Item
    if [[ $i -eq $cursor ]]; then
      printf "  ${C_PRIMARY}┃${NC} ${C_BOLD}${TN_BLUE}${POINTER}${NC} "
    else
      printf "  ${C_DIM}│     ${NC}"
    fi

    if [[ ${_selected[$i]} -eq 1 ]]; then
      printf "${C_SUCCESS}${CHECK_ON}${NC} ${C_BOLD}%-15s${NC}\e[K\n" "$label"
    else
      printf "${C_DIM}${CHECK_OFF}${NC} %-15s\e[K\n" "$label"
    fi
  done
  echo ""
}

# Confirmation prompt
# Usage: confirm "Message" [default: y]
# Returns: 0 for yes, 1 for no
confirm() {
  local message="$1"
  local default="${2:-y}"
  local prompt

  if [[ "$default" == "y" ]]; then
    prompt="[Y/n]"
  else
    prompt="[y/N]"
  fi

  printf "  ${CYAN}?${NC} %s ${DIM}%s${NC} " "$message" "$prompt"

  local response
  read -r response
  response="${response:-$default}"

  [[ "$response" =~ ^[yY] ]]
}

# ─────────────────────────────────────────────────────────────────────────────
# OS Detection
# ─────────────────────────────────────────────────────────────────────────────

DISTRO=""

detect_os() {
  case "$(uname -s)" in
    Darwin) OS="macos" ;;
    Linux)
      OS="linux"
      # Detect Linux distro
      if [[ -f /etc/os-release ]]; then
        # shellcheck disable=SC1091
        source /etc/os-release
        case "$ID" in
          arch|endeavouros|manjaro|garuda) DISTRO="arch" ;;
          ubuntu|debian|pop|linuxmint)     DISTRO="debian" ;;
          fedora|rhel|centos)              DISTRO="fedora" ;;
          *)                               DISTRO="unknown" ;;
        esac
      fi
      ;;
    *)
      print_error "Unsupported OS: $(uname -s)"
      exit 1
      ;;
  esac
}

# ─────────────────────────────────────────────────────────────────────────────
# Dependency Checks
# ─────────────────────────────────────────────────────────────────────────────

check_homebrew() {
  # On Linux, Homebrew is optional - we prefer native package managers
  if [[ "$OS" == "linux" ]]; then
    if command -v brew >/dev/null; then
      print_success "Homebrew available (optional)"
    fi
    return 0
  fi

  # On macOS, Homebrew is required
  if ! command -v brew >/dev/null; then
    print_warning "Homebrew not installed"
    if confirm "Install Homebrew?"; then
      print_info "Installing Homebrew..."
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || \
      eval "$(/usr/local/bin/brew shellenv)" 2>/dev/null || true

      if command -v brew >/dev/null; then
        print_success "Homebrew installed"
      else
        print_error "Homebrew installation failed"
        return 1
      fi
    else
      print_warning "Some features require Homebrew"
      return 1
    fi
  fi
  return 0
}

check_stow() {
  if command -v stow >/dev/null; then
    return 0
  fi

  print_warning "GNU Stow not installed"

  # Try native package manager first on Linux
  if [[ "$OS" == "linux" ]]; then
    case "$DISTRO" in
      arch)
        if confirm "Install stow via pacman?"; then
          sudo pacman -S --noconfirm stow
          command -v stow >/dev/null && print_success "stow installed" && return 0
        fi
        ;;
      debian)
        if confirm "Install stow via apt?"; then
          sudo apt install -y stow
          command -v stow >/dev/null && print_success "stow installed" && return 0
        fi
        ;;
      fedora)
        if confirm "Install stow via dnf?"; then
          sudo dnf install -y stow
          command -v stow >/dev/null && print_success "stow installed" && return 0
        fi
        ;;
    esac
  fi

  # Fallback to Homebrew if available
  if command -v brew >/dev/null; then
    if confirm "Install stow via Homebrew?"; then
      brew install stow
      command -v stow >/dev/null && print_success "stow installed" && return 0
    fi
  fi

  echo ""
  print_error "stow is required. Install manually:"
  print_item "macOS:  brew install stow"
  print_item "Ubuntu: sudo apt install stow"
  print_item "Arch:   sudo pacman -S stow"
  exit 1
}

check_nerd_font() {
  if fc-list 2>/dev/null | grep -qi "jetbrainsmono.*nerd"; then
    return 0
  fi
  if ls ~/Library/Fonts/*JetBrains*Nerd* >/dev/null 2>&1; then
    return 0
  fi
  if ls /Library/Fonts/*JetBrains*Nerd* >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

check_git_status() {
  if [[ -d "$DOTFILES_DIR/.git" ]]; then
    local changes
    changes=$(git -C "$DOTFILES_DIR" status --porcelain 2>/dev/null | head -5)
    if [[ -n "$changes" ]]; then
      print_warning "Uncommitted changes detected"
      echo "$changes" | while read -r line; do
        printf "    ${DIM}%s${NC}\n" "$line"
      done
    fi
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Package Status Checks
# ─────────────────────────────────────────────────────────────────────────────

needs_sync() {
  local pkg="$1"
  [[ ! -d "$DOTFILES_DIR/$pkg" ]] && return 1
  
  # Use dry-run to see if stow wants to do anything significant
  # We ignore "(reverts previous action)" which are often just cosmetic path 
  # string differences (relative vs absolute) that don't affect functionality.
  local changes
  changes=$(stow -nv --target="$HOME" "$pkg" 2>&1 | grep -Ei "LINK:|UNLINK:" | grep -v "reverts previous action" || true)
  
  [[ -n "$changes" ]]
}

get_install_location() {
  local pkg="$1"
  local bin_name="$pkg"

  # Map package names to actual binary names if they differ
  case "$pkg" in
    ripgrep)         bin_name="rg" ;;
    nvim)            bin_name="nvim" ;;
    wireguard-tools) bin_name="wg" ;;
    claude)          bin_name="claude" ;;
    gemini)          bin_name="gemini" ;;
  esac
  
  # 1. Check for binary in PATH
  local path
  path=$(command -v "$bin_name" 2>/dev/null)
  [[ -n "$path" ]] && echo "$path" && return

  # 2. Check for common GUI App names in /Applications
  local app_name=""
  case "$pkg" in
    aerospace) app_name="AeroSpace" ;;
    autoraise) app_name="AutoRaise" ;;
    bitwarden) app_name="Bitwarden" ;;
    ghostty)   app_name="Ghostty" ;;
    karabiner) app_name="Karabiner-Elements" ;;
    localsend) app_name="LocalSend" ;;
    raycast)   app_name="Raycast" ;;
    zsh)       echo "built-in" && return ;;
  esac

  if [[ -n "$app_name" ]]; then
    [[ -d "/Applications/${app_name}.app" ]] && echo "/Applications" && return
    [[ -d "$HOME/Applications/${app_name}.app" ]] && echo "~/Applications" && return
  fi

  return 1
}

is_already_stowed() {
  local pkg="$1"
  [[ ! -d "$DOTFILES_DIR/$pkg" ]] && return 1
  
  # 1. If stow says it doesn't need a sync, it's definitely stowed correctly
  if ! needs_sync "$pkg"; then
    return 0
  fi

  # 2. Fallback check: look for symlinks pointing to our repo
  local pkg_dir="$DOTFILES_DIR/$pkg"
  local check_items
  check_items=$(find "$pkg_dir" -mindepth 1 -maxdepth 4 | head -n 20)
  
  while read -r src_path; do
    [[ -z "$src_path" ]] && continue
    local rel_path="${src_path#$pkg_dir/}"
    local target="$HOME/$rel_path"
    
    if [[ -L "$target" ]]; then
      # Use perl to resolve the absolute path of the link
      local link_target
      link_target=$(perl -MCwd -e 'print Cwd::realpath($ARGV[0])' "$target" 2>/dev/null)
      if [[ "$link_target" == "$DOTFILES_DIR/"* ]]; then
        return 0
      fi
    elif [[ -d "$target" && -d "$src_path" ]]; then
      # If target is a directory, check if any file inside is a symlink to our repo
      if find "$target" -maxdepth 1 -type l -ls 2>/dev/null | grep -qF "$DOTFILES_DIR"; then
        return 0
      fi
    fi
  done <<< "$check_items"

  return 1
}

check_stow_conflicts() {
  local pkg="$1"
  # GNU Stow outputs conflicts to stderr. We want to catch items that are not symlinks.
  stow --no --verbose --target="$HOME" "$pkg" 2>&1 | grep "existing target is not a symlink" | awk -F': ' '{print $2}' || true
}

# ─────────────────────────────────────────────────────────────────────────────
# Zsh Dependencies
# ─────────────────────────────────────────────────────────────────────────────

is_omz_installed() { [[ -d "$HOME/.oh-my-zsh" ]]; }
is_p10k_installed() { [[ -d "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k" ]]; }
is_zsh_autosuggestions_installed() { [[ -d "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-autosuggestions" ]]; }
is_zsh_syntax_highlighting_installed() { [[ -d "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting" ]]; }

install_omz() {
  print_info "Installing oh-my-zsh..."
  sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended --keep-zshrc
  is_omz_installed && print_success "oh-my-zsh installed" && return 0
  print_error "oh-my-zsh installation failed"
  return 1
}

install_p10k() {
  print_info "Installing powerlevel10k..."
  git clone --depth=1 https://github.com/romkatv/powerlevel10k.git \
    "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k"
  is_p10k_installed && print_success "powerlevel10k installed" && return 0
  print_error "powerlevel10k installation failed"
  return 1
}

install_zsh_autosuggestions() {
  print_info "Installing zsh-autosuggestions..."
  git clone https://github.com/zsh-users/zsh-autosuggestions \
    "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-autosuggestions"
  is_zsh_autosuggestions_installed && print_success "zsh-autosuggestions installed" && return 0
  print_error "zsh-autosuggestions installation failed"
  return 1
}

install_zsh_syntax_highlighting() {
  print_info "Installing zsh-syntax-highlighting..."
  git clone https://github.com/zsh-users/zsh-syntax-highlighting.git \
    "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting"
  is_zsh_syntax_highlighting_installed && print_success "zsh-syntax-highlighting installed" && return 0
  print_error "zsh-syntax-highlighting installation failed"
  return 1
}

check_zsh_deps() {
  local all_ok=true

  print_dim "zsh extras:"

  # oh-my-zsh (must be first)
  if is_omz_installed; then
    printf "    ${C_SUCCESS}${CHECK}${NC} oh-my-zsh\n"
  else
    printf "    ${C_ERROR}${CROSS}${NC} oh-my-zsh ${C_DIM}not installed${NC}\n"
    if confirm "Install oh-my-zsh?" "y"; then
      install_omz || all_ok=false
    else
      all_ok=false
    fi
  fi

  # Only check others if oh-my-zsh is installed
  if is_omz_installed; then
    # powerlevel10k
    if is_p10k_installed; then
      printf "    ${C_SUCCESS}${CHECK}${NC} powerlevel10k\n"
    else
      printf "    ${C_ERROR}${CROSS}${NC} powerlevel10k ${C_DIM}not installed${NC}\n"
      if confirm "Install powerlevel10k?" "y"; then
        install_p10k || all_ok=false
      else
        all_ok=false
      fi
    fi

    # zsh-autosuggestions
    if is_zsh_autosuggestions_installed; then
      printf "    ${C_SUCCESS}${CHECK}${NC} zsh-autosuggestions\n"
    else
      printf "    ${C_ERROR}${CROSS}${NC} zsh-autosuggestions ${C_DIM}not installed${NC}\n"
      if confirm "Install zsh-autosuggestions?" "y"; then
        install_zsh_autosuggestions || all_ok=false
      else
        all_ok=false
      fi
    fi

    # zsh-syntax-highlighting
    if is_zsh_syntax_highlighting_installed; then
      printf "    ${C_SUCCESS}${CHECK}${NC} zsh-syntax-highlighting\n"
    else
      printf "    ${C_ERROR}${CROSS}${NC} zsh-syntax-highlighting ${C_DIM}not installed${NC}\n"
      if confirm "Install zsh-syntax-highlighting?" "y"; then
        install_zsh_syntax_highlighting || all_ok=false
      else
        all_ok=false
      fi
    fi
  fi

  $all_ok
}

# ─────────────────────────────────────────────────────────────────────────────
# Sketchybar Dependencies
# ─────────────────────────────────────────────────────────────────────────────

is_sbarlua_installed() { [[ -f "$HOME/.local/share/sketchybar_lua/sketchybar.so" ]]; }

install_sbarlua() {
  spin_task "SbarLua: installing" "git clone https://github.com/FelixKratz/SbarLua.git /tmp/SbarLua && cd /tmp/SbarLua/ && make install && rm -rf /tmp/SbarLua/"
  cd "$DOTFILES_DIR"
  is_sbarlua_installed && return 0
  return 1
}

check_sketchybar_deps() {
  local all_ok=true

  print_dim "sketchybar extras:"

  if is_sbarlua_installed; then
    printf "    ${C_SUCCESS}${CHECK}${NC} SbarLua\n"
  else
    printf "    ${C_ERROR}${CROSS}${NC} SbarLua ${C_DIM}not installed${NC}\n"
    if confirm "Install SbarLua?" "y"; then
      install_sbarlua || all_ok=false
    else
      all_ok=false
    fi
  fi

  # Check for Sketchybar App Font
  if ls ~/Library/Fonts/*sketchybar-app-font* >/dev/null 2>&1 || \
     ls /Library/Fonts/*sketchybar-app-font* >/dev/null 2>&1 || \
     fc-list 2>/dev/null | grep -qi "sketchybar-app-font"; then
    printf "    ${C_SUCCESS}${CHECK}${NC} App Font\n"
  else
    printf "    ${C_ERROR}${CROSS}${NC} App Font ${C_DIM}not installed${NC}\n"
    if confirm "Install Sketchybar App Font?" "y"; then
      spin_task "Brew: installing font" "brew install --cask font-sketchybar-app-font"
    else
      all_ok=false
    fi
  fi

  $all_ok
}

# ─────────────────────────────────────────────────────────────────────────────
# Brew Installation
# ─────────────────────────────────────────────────────────────────────────────

install_pkg_brew() {
  local pkg="$1"
  local brew_cmd="${PKG_BREW_MAP[$pkg]:-}"

  [[ -z "$brew_cmd" ]] && return 0

  if ! command -v brew >/dev/null; then
    print_warning "Homebrew not installed"
    return 1
  fi

  spin_task "Brew: installing $pkg" "brew install $brew_cmd"
}

install_pkg_pacman() {
  local pkg="$1"
  local pacman_pkg="${PKG_PACMAN_MAP[$pkg]:-}"

  [[ -z "$pacman_pkg" ]] && return 0

  # Check if it's an AUR package
  if [[ "$pacman_pkg" == aur:* ]]; then
    local aur_pkg="${pacman_pkg#aur:}"
    # Try yay first, then paru
    if command -v yay >/dev/null; then
      spin_task "AUR (yay): installing $pkg" "yay -S --noconfirm $aur_pkg"
    elif command -v paru >/dev/null; then
      spin_task "AUR (paru): installing $pkg" "paru -S --noconfirm $aur_pkg"
    else
      print_warning "No AUR helper found (yay/paru). Install $aur_pkg manually."
      return 1
    fi
  else
    spin_task "Pacman: installing $pkg" "sudo pacman -S --noconfirm $pacman_pkg"
  fi
}

# Unified package installer - uses appropriate package manager
install_pkg() {
  local pkg="$1"

  if [[ "$OS" == "macos" ]]; then
    install_pkg_brew "$pkg"
  elif [[ "$DISTRO" == "arch" ]]; then
    install_pkg_pacman "$pkg"
  else
    # Fallback to brew if available
    if command -v brew >/dev/null; then
      install_pkg_brew "$pkg"
    else
      print_warning "No supported package manager for $pkg"
      return 1
    fi
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Backup System
# ─────────────────────────────────────────────────────────────────────────────

backup_conflicts() {
  local pkg="$1"
  local conflicts="$2"
  local timestamp=$(date +%Y%m%d_%H%M%S)
  local backup_base="$DOTFILES_DIR/.backups/$timestamp"
  
  print_info "Backing up conflicting items for $pkg..."

  for rel_path in $conflicts; do
    local target="$HOME/$rel_path"
    local backup_path="$backup_base/$pkg/$rel_path"
    
    if [[ -e "$target" && ! -L "$target" ]]; then
      mkdir -p "$(dirname "$backup_path")"
      mv "$target" "$backup_path"
      print_dim "    Backed up: ~/$rel_path"
    fi
  done

  print_success "Backups saved to: .backups/$timestamp/$pkg"
}

# ─────────────────────────────────────────────────────────────────────────────
# Stow Operations
# ─────────────────────────────────────────────────────────────────────────────

stow_packages() {
  local pkgs=("$@")
  local total=${#pkgs[@]}
  local failed=()
  local skipped=()
  local already_done=()
  local to_stow=()

  print_section "Checking Status"

  for pkg in "${pkgs[@]}"; do
    local ready=true
    local install_location
    install_location=$(get_install_location "$pkg")

    # 1. Binary Status
    if [[ -z "$install_location" ]]; then
      printf "  ${C_ERROR}${CROSS}${NC} %-12s ${C_DIM}Binary:  ${NC}${C_ERROR}Not found${NC}\n" "$pkg"
      local pm_name="package manager"
      [[ "$OS" == "macos" ]] && pm_name="Homebrew"
      [[ "$DISTRO" == "arch" ]] && pm_name="pacman"
      if confirm "Install $pkg via $pm_name?" "y"; then
        if ! install_pkg "$pkg"; then
          ready=false
        else
          install_location=$(get_install_location "$pkg")
        fi
      else
        ready=false
      fi
    else
      printf "  ${C_SUCCESS}${CHECK}${NC} %-12s ${C_DIM}Binary:  ${NC}${C_SUCCESS}Installed${NC} ${C_DIM}(%s)${NC}\n" "$pkg" "$install_location"
    fi

    # Check additional deps (even if already stowed, we want to ensure deps are met)
    case "$pkg" in
      zsh) check_zsh_deps || ready=false ;;
      sketchybar) check_sketchybar_deps || ready=false ;;
    esac

    # 2. Symlink Status (only if directory exists in repo)
    if [[ -d "$DOTFILES_DIR/$pkg" ]]; then
      local stowed=$(is_already_stowed "$pkg" && echo "yes" || echo "no")
      if [[ "$stowed" == "yes" ]]; then
        printf "    ${C_SUCCESS}${CHECK}${NC} ${C_DIM}Symlink: ${NC}${C_INFO}Active${NC} ${C_DIM}(stowed)${NC}\n"
        
        # Check if it actually needs an update (new files, etc)
        if needs_sync "$pkg"; then
          to_stow+=("$pkg")
          already_done+=("$pkg") 
        else
          already_done+=("$pkg")
          # Important: Skip to next package, everything is perfect
          continue
        fi
      else
        printf "    ${C_WARNING}${BULLET}${NC} ${C_DIM}Symlink: ${NC}${C_WARNING}Inactive${NC} ${C_DIM}(not stowed)${NC}\n"
        to_stow+=("$pkg")
      fi
    fi

    # 3. Check Nerd Font for terminal packages
    case "$pkg" in
      ghostty|zsh)
        if ! check_nerd_font; then
          print_warning "JetBrainsMono Nerd Font not found"
          if [[ "$OS" == "macos" ]]; then
            if confirm "Install via Homebrew?" "y"; then
              spin_task "Brew: installing font" "brew install --cask font-jetbrains-mono-nerd-font"
            fi
          elif [[ "$DISTRO" == "arch" ]]; then
            if confirm "Install via pacman?" "y"; then
              spin_task "Pacman: installing font" "sudo pacman -S --noconfirm ttf-jetbrains-mono-nerd"
            fi
          fi
        fi
        ;;
    esac

    if [[ "$ready" == true ]]; then
      # ONLY add to to_stow if there is a directory to stow in the repo
      if [[ -d "$DOTFILES_DIR/$pkg" ]]; then
        local already_in_list=false
        for p in "${to_stow[@]}"; do [[ "$p" == "$pkg" ]] && already_in_list=true && break; done
        [[ "$already_in_list" == false ]] && to_stow+=("$pkg")
      fi
    else
      print_warning "Skipping $pkg (missing dependencies)"
      skipped+=("$pkg")
    fi
  done

  # Handle already stowed
  if [[ ${#to_stow[@]} -eq 0 ]]; then
    if [[ ${#already_done[@]} -gt 0 ]]; then
      print_section "Summary"
      print_success "All packages already configured"
      return 0
    else
      print_error "No packages to stow"
      return 1
    fi
  fi

  print_section "Installing Configs"
  
  local count=0
  local total_to_stow=${#to_stow[@]}

  for pkg in "${to_stow[@]}"; do
    ((count++))
    draw_progress $count $total_to_stow
    
    if [[ ! -d "$DOTFILES_DIR/$pkg" ]]; then
      # If no directory in repo, it's a brew-only tool, no work to do
      continue
    fi

    # Check for conflicts
    local conflicts
    conflicts=$(check_stow_conflicts "$pkg")
    if [[ -n "$conflicts" ]]; then
      printf "\n  ${C_WARNING}!${NC} %-12s ${C_DIM}has conflicts${NC}\n" "$pkg"
      if confirm "Backup and continue?" "y"; then
        backup_conflicts "$pkg" "$conflicts"
      else
        skipped+=("$pkg")
        continue
      fi
    fi

    # Actually stow
    if stow -v --target="$HOME" --restow "$pkg" > /dev/null 2>&1; then
      :
    else
      printf "\n  ${C_ERROR}${CROSS}${NC} %-12s ${C_DIM}failed${NC}\n" "$pkg"
      failed+=("$pkg")
    fi
  done
  echo ""

  # Summary
  print_section "Summary"
  
  local total_updated=0
  local total_new=0
  
  for pkg in "${to_stow[@]}"; do
    # Check if failed or skipped
    local was_failed=false
    for f in "${failed[@]}"; do [[ "$pkg" == "$f" ]] && was_failed=true && break; done
    [[ "$was_failed" == true ]] && continue

    local was_skipped=false
    for s in "${skipped[@]}"; do [[ "$pkg" == "$s" ]] && was_skipped=true && break; done
    [[ "$was_skipped" == true ]] && continue

    # Check if it was already stowed (updated) or new
    local was_already=false
    for a in "${already_done[@]}"; do [[ "$pkg" == "$a" ]] && was_already=true && break; done
    
    if [[ "$was_already" == true ]]; then
      ((total_updated++))
    else
      ((total_new++))
    fi
  done

  if [[ ${#failed[@]} -eq 0 ]]; then
    if [[ $total_updated -eq 0 && $total_new -eq 0 ]]; then
      print_success "All packages already configured"
    else
      local total_ok=$((total_updated + total_new))
      print_success "${total_ok} package(s) configured successfully"
      [[ $total_updated -gt 0 ]] && printf "    ${C_DIM}(%d updated)${NC}\n" "$total_updated"
      [[ $total_new -gt 0 ]] && printf "    ${C_DIM}(%d newly linked)${NC}\n" "$total_new"
    fi
  else
    print_warning "${#failed[@]} package(s) failed"
  fi

  return 0
}

unstow_packages() {
  local pkgs=("$@")
  local failed=()
  local count=0
  local total=${#pkgs[@]}

  print_section "Removing Configs"

  for pkg in "${pkgs[@]}"; do
    ((count++))
    draw_progress $count $total
    
    if [[ -d "$DOTFILES_DIR/$pkg" ]]; then
      if stow -v --target="$HOME" -D "$pkg" > /dev/null 2>&1; then
        :
      else
        printf "\n  ${C_ERROR}${CROSS}${NC} %-12s ${C_DIM}failed${NC}\n" "$pkg"
        failed+=("$pkg")
      fi
    else
      printf "\n  ${C_WARNING}!${NC} %-12s ${C_DIM}not found${NC}\n" "$pkg"
    fi
  done
  echo ""

  print_section "Summary"
  if [[ ${#failed[@]} -eq 0 ]]; then
    print_success "${#pkgs[@]} package(s) removed"
  else
    print_warning "${#failed[@]} package(s) failed"
  fi

  return 0
}

# ─────────────────────────────────────────────────────────────────────────────
# Package Selection
# ─────────────────────────────────────────────────────────────────────────────

select_packages() {
  local items=()

  if [[ "$OS" == "macos" ]]; then
    for pkg in "${MACOS_PKGS[@]}"; do
      items+=("macOS:$pkg")
    done
  fi

  for pkg in "${TERMINAL_PKGS[@]}"; do
    items+=("Terminal:$pkg")
  done

  menu_multiselect "Select Packages" "${items[@]}"

  if [[ -n "$MENU_RESULT" ]]; then
    # shellcheck disable=SC2206
    SELECTED_PKGS=($MENU_RESULT)
    return 0
  fi
  return 1
}

# ─────────────────────────────────────────────────────────────────────────────
# Actions
# ─────────────────────────────────────────────────────────────────────────────

action_brew_bundle() {
  if [[ ! -f "$DOTFILES_DIR/Brewfile" ]]; then
    print_error "Brewfile not found in $DOTFILES_DIR"
    return 1
  fi

  print_section "Homebrew Bundle"
  print_dim "Installing packages from Brewfile..."
  echo ""
  
  if confirm "Proceed?"; then
    print_info "Running brew bundle... (this may take a while)"
    if brew bundle --file="$DOTFILES_DIR/Brewfile"; then
      print_success "Brew bundle completed"
    else
      print_error "Brew bundle failed"
    fi
  else
    print_info "Cancelled"
  fi
}

action_full_steez() {
  local stow_pkgs=("${TERMINAL_PKGS[@]}" "${GIT_PKGS[@]}")
  [[ "$OS" == "macos" ]] && stow_pkgs+=("${MACOS_PKGS[@]}")
  local all_pkgs=("${stow_pkgs[@]}" "${BREW_ONLY_PKGS[@]}")

  print_section "Full Setup"
  
  if [[ "$OS" == "macos" ]]; then
    print_dim "This will install all apps/tools from Brewfile AND link all configs."
  else
    print_dim "The following packages will be installed/linked:"
    for pkg in "${all_pkgs[@]}"; do
      print_item "$pkg"
    done
  fi
  echo ""

  if confirm "Proceed with installation?"; then
    if [[ "$OS" == "macos" ]]; then
      action_brew_bundle
    fi
    stow_packages "${all_pkgs[@]}"
  else
    print_info "Cancelled"
  fi
}

action_terminal_only() {
  local stow_pkgs=("${TERMINAL_PKGS[@]}")
  local all_pkgs=("${stow_pkgs[@]}" "${BREW_ONLY_PKGS[@]}")

  print_section "Terminal Setup"
  
  if [[ "$OS" == "macos" ]]; then
    print_dim "This will install all apps/tools from Brewfile AND link terminal configs."
  else
    print_dim "The following packages will be installed/linked:"
    for pkg in "${all_pkgs[@]}"; do
      print_item "$pkg"
    done
  fi
  echo ""

  if confirm "Proceed with installation?"; then
    if [[ "$OS" == "macos" ]]; then
      action_brew_bundle
    fi
    stow_packages "${all_pkgs[@]}"
  else
    print_info "Cancelled"
  fi
}

action_custom() {
  if select_packages; then
    echo ""
    print_section "Custom Setup"
    print_dim "The following packages will be installed:"
    for pkg in "${SELECTED_PKGS[@]}"; do
      print_item "$pkg"
    done
    echo ""

    if confirm "Proceed with installation?"; then
      stow_packages "${SELECTED_PKGS[@]}"
    else
      print_info "Cancelled"
    fi
  fi
}

action_unstow() {
  if select_packages; then
    echo ""
    print_section "Uninstall"
    print_dim "The following packages will be removed:"
    for pkg in "${SELECTED_PKGS[@]}"; do
      print_item "$pkg"
    done
    echo ""

    if confirm "Proceed with removal?"; then
      unstow_packages "${SELECTED_PKGS[@]}"
    else
      print_info "Cancelled"
    fi
  fi
}

action_status() {
  print_section "Package Status"

  local all_pkgs=("${TERMINAL_PKGS[@]}" "${MACOS_PKGS[@]}" "${GIT_PKGS[@]}")
  
  # Check all packages
  for pkg in "${all_pkgs[@]}"; do
    [[ -z "$pkg" ]] && continue
    local location
    location=$(get_install_location "$pkg")
    local stowed=$(is_already_stowed "$pkg" && echo "yes" || echo "no")

    if [[ -z "$location" ]]; then
      printf "  ${C_ERROR}${CROSS}${NC} %-12s ${C_DIM}not installed${NC}\n" "$pkg"
    elif [[ -d "$DOTFILES_DIR/$pkg" ]]; then
      if [[ "$stowed" == "yes" ]]; then
        printf "  ${C_SUCCESS}${CHECK}${NC} %-12s ${C_DIM}%s ${C_INFO}(stowed)${NC}\n" "$pkg" "$location"
      else
        printf "  ${C_WARNING}${BULLET}${NC} %-12s ${C_DIM}%s (not stowed)${NC}\n" "$pkg" "$location"
      fi
    else
      # Binary only, no config to stow
      printf "  ${C_SUCCESS}${CHECK}${NC} %-12s ${C_DIM}%s${NC}\n" "$pkg" "$location"
    fi
  done
}

# ─────────────────────────────────────────────────────────────────────────────
# Main Menu
# ─────────────────────────────────────────────────────────────────────────────

show_main_menu() {
  local options=()

  if [[ "$OS" == "macos" ]]; then
    options+=(
      "Full Setup|AI + macOS + Terminal"
      "Terminal Only|AI + Terminal apps"
      "Custom|Select individual packages"
      "Brew Bundle|Install from Brewfile"
      "Uninstall|Remove symlinks"
      "Status|View package status"
    )
  else
    options+=(
      "Full Setup|AI + Terminal apps"
      "Custom|Select individual packages"
      "Uninstall|Remove symlinks"
      "Status|View package status"
    )
  fi

  menu_select "What would you like to do?" "${options[@]}"

  case $MENU_RESULT in
    -1) exit 0 ;;
  esac

  if [[ "$OS" == "macos" ]]; then
    case $MENU_RESULT in
      0) action_full_steez ;;
      1) action_terminal_only ;;
      2) action_custom ;;
      3) action_brew_bundle ;;
      4) action_unstow ;;
      5) action_status ;;
    esac
  else
    case $MENU_RESULT in
      0) action_full_steez ;;
      1) action_custom ;;
      2) action_unstow ;;
      3) action_status ;;
    esac
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Post-Install Info
# ─────────────────────────────────────────────────────────────────────────────

show_post_info() {
  print_section "Next Steps"
  print_item "Create ${C_BOLD}~/.zshrc.local${NC} for machine-specific config"
  print_item "Run ${C_BOLD}exec zsh${NC} to reload shell"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

main() {
  # Handle flags
  if [[ "${1:-}" == "--version" || "${1:-}" == "-v" ]]; then
    printf "steez-dotfiles installer v%s\n" "$VERSION"
    exit 0
  fi

  cd "$DOTFILES_DIR"

  clear
  print_banner
  
  detect_os
  show_sysinfo
  
  # Pre-flight checks
  check_git_status
  check_homebrew || true
  check_stow

  show_main_menu
  show_post_info
}

main "$@"
