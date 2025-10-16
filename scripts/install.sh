#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_DOTFILES_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

DRY_RUN=false
VERBOSE=false
AUTO_CONFIRM=false
PROFILE_KEY=""
PROFILE_LABEL=""
TARGET_HOME="${HOME}"
DOTFILES_DIR="${DEFAULT_DOTFILES_DIR}"
BREW_BIN=""
ESSENTIAL_FORMULAE=(neovim fzf ripgrep)
ESSENTIAL_CASKS=(ghostty)

log() {
  local level="$1"; shift
  if [[ "$level" == "VERB" && "$VERBOSE" != true ]]; then
    return
  fi
  printf '[%s] %s\n' "$level" "$*"
}

bot()    { log "BOT" "$*"; }
action() { log ".." "$*"; }
ok()     { log "OK" "$*"; }
warn()   { log "WARN" "$*"; }
error()  { log "ERR" "$*"; }
verb()   { log "VERB" "$*"; }

die() {
  error "$*"
  exit 1
}

usage() {
  cat <<USAGE
Usage: ${0##*/} [options]

Options:
  --dry-run             Print actions without executing them
  --verbose             Print additional details during execution
  --home-dir PATH       Override target home directory (default: ${TARGET_HOME})
  --dotfiles-dir PATH   Override dotfiles repo path (default: ${DOTFILES_DIR})
  -y, --yes             Skip confirmation prompt before making changes
  -h, --help            Show this help
USAGE
}

print_banner() {
  local green_bold="\033[1;32m"
  local green="\033[0;32m"
  local reset="\033[0m"
  printf '%b%s%b\n' "$green_bold" '  _______/  |_  ____   ____ ________' "$reset"
  printf '%b%s%b\n' "$green_bold" ' /  ___/\   __\/ __ \_/ __ \\___   /' "$reset"
  printf '%b%s%b\n' "$green_bold" ' \___ \  |  | \  ___/\  ___/ /    / ' "$reset"
  printf '%b%s%b\n' "$green_bold" '/____  > |__|  \___  >\___  >_____ \' "$reset"
  printf '%b%s%b\n' "$green_bold" '     \/            \/     \/      \/' "$reset"
  printf "%b%s%b\n\n" "$green" "       steez terminal bootstrap" "$reset"
}

run_step() {
  local description="$1"; shift
  action "$description"
  if "$DRY_RUN"; then
    log "DRY" "$*"
  else
    "$@"
  fi
}

run_cmd() {
  if "$DRY_RUN"; then
    log "DRY" "$*"
  else
    "$@"
  fi
}

run_shell() {
  local cmd="$1"
  if "$DRY_RUN"; then
    log "DRY" "$cmd"
  else
    /bin/bash -lc "$cmd"
  fi
}

ensure_dir() {
  local dir="$1"
  if [[ -d "$dir" ]]; then
    return
  fi
  if "$DRY_RUN"; then
    log "DRY" "mkdir -p \"$dir\""
  else
    mkdir -p "$dir"
  fi
}

ensure_xcode_clt() {
  if xcode-select --print-path >/dev/null 2>&1; then
    ok "Xcode Command Line Tools already installed."
    return
  fi
  warn "Xcode Command Line Tools not detected."
  if "$DRY_RUN"; then
    log "DRY" "xcode-select --install (interactive prompt expected)"
  else
    action "Triggering Xcode Command Line Tools installer"
    xcode-select --install >/dev/null 2>&1 || true
    warn "Follow the on-screen installer to finish installing the Command Line Tools."
  fi
}

detect_brew_bin() {
  if command -v brew >/dev/null 2>&1; then
    BREW_BIN="$(command -v brew)"
    return 0
  fi
  if [[ -x /opt/homebrew/bin/brew ]]; then
    BREW_BIN="/opt/homebrew/bin/brew"
    return 0
  fi
  if [[ -x /usr/local/bin/brew ]]; then
    BREW_BIN="/usr/local/bin/brew"
    return 0
  fi
  return 1
}

ensure_homebrew() {
  if detect_brew_bin; then
    ok "Homebrew found at ${BREW_BIN}"
  else
    warn "Homebrew not found."
    if "$DRY_RUN"; then
      log "DRY" "Install Homebrew via official script"
      BREW_BIN="/opt/homebrew/bin/brew"
    else
      action "Installing Homebrew"
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      detect_brew_bin || die "Homebrew installation completed but brew not found in PATH."
      ok "Homebrew installed at ${BREW_BIN}"
    fi
  fi

  if ! "$DRY_RUN"; then
    eval "$("$BREW_BIN" shellenv)"
    export BREW_BIN
  fi
}

ensure_brew_available() {
  if [[ -z "$BREW_BIN" ]]; then
    detect_brew_bin || die "brew command not found after install."
  fi
}

ensure_formula_installed() {
  local formula="$1"
  ensure_brew_available
  if "$BREW_BIN" list --formula "$formula" >/dev/null 2>&1; then
    ok "brew formula '${formula}' already installed"
    return
  fi

  if "$DRY_RUN"; then
    log "DRY" "$BREW_BIN install ${formula}"
  else
    action "Installing brew formula '${formula}'"
    "$BREW_BIN" install "$formula"
    ok "Installed ${formula}"
  fi
}

ensure_cask_installed() {
  local cask="$1"
  ensure_brew_available
  if "$BREW_BIN" list --cask "$cask" >/dev/null 2>&1; then
    ok "brew cask '${cask}' already installed"
    return
  fi

  if "$DRY_RUN"; then
    log "DRY" "$BREW_BIN install --cask ${cask}"
  else
    action "Installing brew cask '${cask}'"
    "$BREW_BIN" install --cask "$cask"
    ok "Installed ${cask}"
  fi
}

ensure_essential_packages() {
  bot "Ensuring essential terminal packages"
  local formula
  for formula in "${ESSENTIAL_FORMULAE[@]}"; do
    ensure_formula_installed "$formula"
  done

  local cask
  for cask in "${ESSENTIAL_CASKS[@]}"; do
    ensure_cask_installed "$cask"
  done
}

ensure_ohmyzsh() {
  local omz_dir="${TARGET_HOME}/.oh-my-zsh"
  if [[ -d "$omz_dir" ]]; then
    ok "Oh My Zsh already present at $omz_dir"
    return
  fi

  if "$DRY_RUN"; then
    log "DRY" "Install Oh My Zsh into ${omz_dir}"
  else
    action "Installing Oh My Zsh"
    RUNZSH=no CHSH=no KEEP_ZSHRC=yes \
      /bin/sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
    ok "Oh My Zsh installed"
  fi
}

ensure_git_clone() {
  local dest="$1"
  local repo="$2"
  local name="$3"
  if [[ -d "$dest" ]]; then
    ok "$name already present"
    return
  fi

  ensure_dir "$(dirname "$dest")"

  if "$DRY_RUN"; then
    log "DRY" "git clone $repo \"$dest\""
  else
    action "Cloning $name"
    git clone --depth=1 "$repo" "$dest"
    ok "$name installed"
  fi
}

ensure_ohmyzsh_assets() {
  local zsh_custom="${TARGET_HOME}/.oh-my-zsh/custom"
  ensure_dir "$zsh_custom"
  ensure_git_clone "${zsh_custom}/themes/powerlevel10k" "https://github.com/romkatv/powerlevel10k.git" "powerlevel10k theme"
  ensure_git_clone "${zsh_custom}/plugins/zsh-autosuggestions" "https://github.com/zsh-users/zsh-autosuggestions.git" "zsh-autosuggestions plugin"
  ensure_git_clone "${zsh_custom}/plugins/zsh-syntax-highlighting" "https://github.com/zsh-users/zsh-syntax-highlighting.git" "zsh-syntax-highlighting plugin"
}

should_backup() {
  local path="$1"
  if [[ ! -e "$path" && ! -L "$path" ]]; then
    return 1
  fi
  if [[ -L "$path" ]]; then
    local target
    target="$(readlink "$path")"
    if [[ "$target" == "$DOTFILES_DIR"* ]]; then
      return 1
    fi
  fi
  return 0
}

backup_existing_files() {
  bot "Backing up existing dotfiles"
  local timestamp backup_root backup_dir
  timestamp="$(date +"%Y.%m.%d.%H.%M.%S")"
  backup_root="${TARGET_HOME}/.dotfiles_backup"
  backup_dir="${backup_root}/${timestamp}"

  if "$DRY_RUN"; then
    log "DRY" "mkdir -p \"$backup_dir\""
  else
    ensure_dir "$backup_dir"
  fi

  local paths=(
    "${TARGET_HOME}/.zshrc"
    "${TARGET_HOME}/.zprofile"
    "${TARGET_HOME}/.p10k.zsh"
    "${TARGET_HOME}/.oh-my-zsh/custom/aliases.zsh"
    "${TARGET_HOME}/.config/ghostty/config"
    "${TARGET_HOME}/.config/nvim"
  )

  local path rel_path
  for path in "${paths[@]}"; do
    if should_backup "$path"; then
      rel_path="${path#${TARGET_HOME}/}"
      rel_path="${rel_path#.}"
      rel_path="${rel_path#/}"
      local dest="${backup_dir}/${rel_path}"
      if "$DRY_RUN"; then
        log "DRY" "mkdir -p \"$(dirname "$dest")\""
      else
        ensure_dir "$(dirname "$dest")"
      fi
      if "$DRY_RUN"; then
        log "DRY" "mv \"$path\" \"$dest\""
      else
        action "Backing up ${path} -> ${dest}"
        mv "$path" "$dest"
        ok "Backed up ${path}"
      fi
    else
      action "No backup needed for ${path}"
    fi
  done

  if ! "$DRY_RUN"; then
    export LAST_BACKUP_DIR="$backup_dir"
  else
    export LAST_BACKUP_DIR="(dry-run)"
  fi
}

create_symlink() {
  local source="$1"
  local target="$2"

  if [[ -L "$target" ]]; then
    local existing
    existing="$(readlink "$target")"
    if [[ "$existing" == "$source" ]]; then
      ok "Symlink already in place for $target"
      return
    fi
    if "$DRY_RUN"; then
      log "DRY" "rm \"$target\""
    else
      action "Removing stale symlink at $target"
      rm "$target"
    fi
  elif [[ -e "$target" ]]; then
    if "$DRY_RUN"; then
      log "DRY" "rm \"$target\""
    else
      warn "Expected $target to be absent after backup, skipping link."
      return
    fi
  fi

  if "$DRY_RUN"; then
    log "DRY" "ln -s \"$source\" \"$target\""
  else
    ensure_dir "$(dirname "$target")"
    action "Linking $target -> $source"
    ln -s "$source" "$target"
    ok "Linked $target"
  fi
}

create_symlinks() {
  bot "Creating symlinks"
  local mappings=(
    "$DOTFILES_DIR/zsh/.zshrc|$TARGET_HOME/.zshrc"
    "$DOTFILES_DIR/zsh/.zprofile|$TARGET_HOME/.zprofile"
    "$DOTFILES_DIR/zsh/.p10k.zsh|$TARGET_HOME/.p10k.zsh"
    "$DOTFILES_DIR/zsh/.oh-my-zsh/custom/aliases.zsh|$TARGET_HOME/.oh-my-zsh/custom/aliases.zsh"
    "$DOTFILES_DIR/ghostty/config|$TARGET_HOME/.config/ghostty/config"
    "$DOTFILES_DIR/nvim|$TARGET_HOME/.config/nvim"
  )

  local entry source target
  for entry in "${mappings[@]}"; do
    source="${entry%%|*}"
    target="${entry#*|}"
    create_symlink "$source" "$target"
  done
}

preflight() {
  bot "Running preflight checks"
  ensure_xcode_clt
  ensure_homebrew
  ensure_essential_packages
  ensure_ohmyzsh
  ensure_ohmyzsh_assets
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run)
        DRY_RUN=true
        shift
        ;;
      --verbose)
        VERBOSE=true
        shift
        ;;
      --home-dir)
        [[ $# -lt 2 ]] && die "--home-dir requires a path"
        TARGET_HOME="$2"
        shift 2
        ;;
      --dotfiles-dir)
        [[ $# -lt 2 ]] && die "--dotfiles-dir requires a path"
        DOTFILES_DIR="$2"
        shift 2
        ;;
      -y|--yes)
        AUTO_CONFIRM=true
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "Unknown argument: $1"
        ;;
    esac
  done

}

show_menu() {
  local options=("Steez's Ghostty config" "Cancel / Exit")
  local keys=("steez-ghostty" "exit")

  if [[ ! -t 0 ]]; then
    PROFILE_KEY="${keys[0]}"
    PROFILE_LABEL="${options[0]}"
    print_banner
    return
  fi

  local index=0
  local prompt="Use ↑/↓ to choose, Enter to confirm, q to quit."
  local esc=$'\033'
  local bold reset clear_cmd highlight

  if command -v tput >/dev/null 2>&1; then
    bold="$(tput bold 2>/dev/null || printf '\033[1m')"
    reset="$(tput sgr0 2>/dev/null || printf '\033[0m')"
    clear_cmd="tput clear"
    highlight="$(tput rev 2>/dev/null || printf '\033[7m')"
  else
    bold=$'\033[1m'
    reset=$'\033[0m'
    clear_cmd="printf '\033[H\033[2J'"
    highlight=$'\033[7m'
  fi

  draw_menu() {
    printf '%s\n\n' "$prompt"
    local i
    for i in "${!options[@]}"; do
      if [[ $i -eq $index ]]; then
        printf ' > %s%s%s\n' "$highlight" "${options[$i]}" "$reset"
      else
        printf '   %s\n' "${options[$i]}"
      fi
    done
  }

  while [[ -z "$PROFILE_KEY" ]]; do
    eval "$clear_cmd"
    print_banner
    draw_menu

    IFS= read -rsn1 key || continue
    if [[ $key == $esc ]]; then
      IFS= read -rsn1 -t 1 key || continue
      if [[ $key == "[" ]]; then
        IFS= read -rsn1 -t 1 key || continue
        case "$key" in
          "A") index=$(((index - 1 + ${#options[@]}) % ${#options[@]})) ;;
          "B") index=$(((index + 1) % ${#options[@]})) ;;
        esac
      fi
    elif [[ -z "$key" ]]; then
      PROFILE_KEY="${keys[$index]}"
      PROFILE_LABEL="${options[$index]}"
    elif [[ "$key" == "q" || "$key" == "Q" ]]; then
      die "No setup selected."
    fi
  done

  eval "$clear_cmd"
  print_banner

  if [[ "$PROFILE_KEY" == "exit" ]]; then
    die "No setup selected."
  fi
}

finish_prompt() {
  echo
  local green="\033[0;32m"
  local bold="\033[1m"
  local reset="\033[0m"
  printf '%b%s%b\n\n' "$green" "==============================================" "$reset"
  printf '%s\n' "[OK] Setup complete for ${PROFILE_LABEL}."
  printf '%b%s%b\n\n' "$green" "Welcome to the Ghosteez Terminal. Spin up Ghostty when you’re ready to dive in." "$reset"

  printf '%bKey files to customize%b\n' "$bold" "$reset"
  printf '  %b%-15s%b → %s\n' "$green" "Shell config" "$reset" "~/.dotfiles/zsh/.zshrc"
  printf '  %b%-15s%b → %s\n' "$green" "Alias helpers" "$reset" "~/.dotfiles/zsh/.oh-my-zsh/custom/aliases.zsh"
  printf '      %-10s %s\n' "fcd" "(fzf pick → cd into directory)"
  printf '      %-10s %s\n' "fnv" "(fzf pick → open in Neovim)"
  printf '  %b%-15s%b → %s\n' "$green" "Neovim setup" "$reset" "~/.dotfiles/nvim/"
  printf '  %b%-15s%b → %s\n' "$green" "Ghostty theme" "$reset" "~/.dotfiles/ghostty/config"
  printf '\n'
  printf '%s\n' "Edit files directly under ~/.dotfiles, then run \`exec zsh\` or relaunch the terminal."
  printf '%s\n' "Neovim (\`nvim\`) is ready—first launch will sync LazyVim plugins automatically."
  printf '\n'

  # offer to launch Ghostty if available
  if command -v ghostty >/dev/null 2>&1 || [[ -d "/Applications/Ghostty.app" ]]; then
    if "$DRY_RUN"; then
      log "DRY" "Prompt user to launch Ghostty now."
      log "DRY" "Would run: open -a Ghostty (fallback to ghostty CLI)"
      return
    fi

    printf "Launch Ghostty now? [y/N] "
    read -r launch_response
    if [[ "$launch_response" =~ ^([yY]|[yY][eE][sS])$ ]]; then
      if command -v open >/dev/null 2>&1; then
        if ! open -a Ghostty >/dev/null 2>&1; then
          command -v ghostty >/dev/null 2>&1 && ghostty >/dev/null 2>&1 &
        fi
        ok "Ghostty launched."
      elif command -v ghostty >/dev/null 2>&1; then
        ghostty >/dev/null 2>&1 &
        ok "Ghostty launched."
      else
        warn "Ghostty application not found in PATH."
      fi
    else
      action "Skipped launching Ghostty."
    fi
  else
    action "Ghostty not found; skipping launch prompt."
  fi
}

validate_paths() {
  [[ -d "$DOTFILES_DIR" ]] || die "Dotfiles directory not found: $DOTFILES_DIR"
  [[ -d "$TARGET_HOME" ]] || die "Home directory not found: $TARGET_HOME"
}

confirm_execution() {
  if "$DRY_RUN" || "$AUTO_CONFIRM"; then
    return
  fi
  printf "\nProceed with %s in %s? [y/N] " "$PROFILE_LABEL" "$TARGET_HOME"
  read -r response
  if [[ ! "$response" =~ ^([yY]|[yY][eE][sS])$ ]]; then
    die "Aborted by user."
  fi
}

main() {
  parse_args "$@"
  show_menu
  validate_paths
  bot "Installer starting"
  log "INFO" "Dry run: $DRY_RUN"
  log "INFO" "Verbose: $VERBOSE"
  log "INFO" "Target home: $TARGET_HOME"
  log "INFO" "Dotfiles dir: $DOTFILES_DIR"
  log "INFO" "Selected setup: $PROFILE_LABEL"

  confirm_execution
  case "$PROFILE_KEY" in
    steez-ghostty)
      preflight
      backup_existing_files
      create_symlinks
      finish_prompt
      ;;
    *)
      die "Unknown setup selected: $PROFILE_KEY"
      ;;
  esac
}

main "$@"
