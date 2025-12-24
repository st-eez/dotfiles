#!/usr/bin/env bash

# Installation Logic
# Depends on: lib/bootstrap.sh, lib/config.sh, lib/ui.sh

# Install a single package using the system package manager
# Usage: install_package "package_name"
# Returns: 0 on success, 1 on failure
install_package() {
    local pkg="$1"
    local cmd=""
    local label=""

    # 1. Resolve Command based on OS
    if [[ "$OS" == "macos" ]]; then
        local brew_args="${PKG_BREW_MAP[$pkg]:-}"
        if [[ -n "$brew_args" ]]; then
            cmd="brew install $brew_args"
            label="Brew: installing $pkg"
        fi
    elif [[ "$DISTRO" == "arch" ]]; then
        local pacman_pkg="${PKG_PACMAN_MAP[$pkg]:-}"
        if [[ -n "$pacman_pkg" ]]; then
            if [[ "$pacman_pkg" == aur:* ]]; then
                local aur_pkg="${pacman_pkg#aur:}"
                if command -v yay >/dev/null; then
                    cmd="yay -S --noconfirm $aur_pkg"
                    label="AUR (yay): installing $pkg"
                elif command -v paru >/dev/null; then
                    cmd="paru -S --noconfirm $aur_pkg"
                    label="AUR (paru): installing $pkg"
                else
                    gum style --foreground "$THEME_WARNING" "Skipping $pkg: No AUR helper found (yay/paru)"
                    return 1
                fi
            else
                cmd="sudo pacman -S --noconfirm $pacman_pkg"
                label="Pacman: installing $pkg"
            fi
        fi
    elif [[ "$DISTRO" == "debian" ]]; then
        # For now, we assume package name matches or map it manually if needed
        # In a real scenario, we'd need a PKG_APT_MAP
        cmd="sudo apt install -y $pkg"
        label="Apt: installing $pkg"
    fi

    # 2. Execute with Spinner
    if [[ -n "$cmd" ]]; then
        if gum spin --spinner dot --title "$label" -- $cmd; then
            return 0
        else
            gum style --foreground "$THEME_ERROR" "Failed to install $pkg"
            return 1
        fi
    else
        # No mapping found, assume it's just a config package (no binary to install)
        return 0
    fi
}

# Check for stow conflicts
# Returns: newline-separated list of conflicting files
check_stow_conflicts() {
    local pkg="$1"
    # GNU Stow outputs conflicts to stderr. We want to catch items that are not symlinks.
    stow --no --verbose --target="$HOME" "$pkg" 2>&1 | grep "existing target is not a symlink" | awk -F': ' '{print $2}' || true
}

# Stow a package (link configs)
# Usage: stow_package "package_name"
# Returns: 0 on success, 1 on failure
stow_package() {
    local pkg="$1"

    if [[ ! -d "$DOTFILES_DIR/$pkg" ]]; then
        # Brew-only package, nothing to stow
        return 0
    fi

    # 1. Check for conflicts
    local conflicts
    conflicts=$(check_stow_conflicts "$pkg")
    
    if [[ -n "$conflicts" ]]; then
        gum style --foreground "$THEME_WARNING" "Conflicts detected for $pkg"
        if ui_confirm "Backup existing files and proceed?"; then
             # shellcheck disable=SC1090
             source "$DOTFILES_DIR/lib/utils.sh"
             backup_conflicts "$pkg" "$conflicts"
        else
            gum style --foreground "$THEME_ERROR" "Skipping $pkg (conflicts)"
            return 1
        fi
    fi

    # 2. Stow
    if stow -v --target="$HOME" --restow "$pkg" > /dev/null 2>&1; then
        return 0
    else
        gum style --foreground "$THEME_ERROR" "Stow failed for $pkg"
        return 1
    fi
}

# Check if a package is installed
# Usage: is_installed "package_name"
is_installed() {
    local pkg="$1"
    
    # 1. Simple command check
    if command -v "$pkg" >/dev/null 2>&1; then
        return 0
    fi

    # 2. Check MacOS Applications
    if [[ "$OS" == "macos" ]]; then
        case "$pkg" in
            aerospace) [[ -d "/Applications/AeroSpace.app" ]] && return 0 ;;
            autoraise) [[ -d "/Applications/AutoRaise.app" ]] && return 0 ;;
            bitwarden) [[ -d "/Applications/Bitwarden.app" ]] && return 0 ;;
            ghostty)   [[ -d "/Applications/Ghostty.app" ]] && return 0 ;;
            karabiner) [[ -d "/Applications/Karabiner-Elements.app" ]] && return 0 ;;
            localsend) [[ -d "/Applications/LocalSend.app" ]] && return 0 ;;
            raycast)   [[ -d "/Applications/Raycast.app" ]] && return 0 ;;
        esac
    fi

    return 1
}
