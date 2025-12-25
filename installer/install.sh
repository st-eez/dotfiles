#!/usr/bin/env bash

# Installation Logic
# Depends on: lib/bootstrap.sh, lib/config.sh, lib/ui.sh

# Bootstrap an AUR helper (yay) if none exists
bootstrap_aur_helper() {
    if [[ "$DISTRO" != "arch" ]]; then
        return 0
    fi

    if command -v yay >/dev/null 2>&1 || command -v paru >/dev/null 2>&1; then
        return 0
    fi

    gum style --foreground "$THEME_SECONDARY" "No AUR helper found. Bootstrapping yay..."

    # Ensure base-devel and git are installed
    sudo pacman -S --needed --noconfirm base-devel git || return 1

    local tmp_dir
    tmp_dir=$(mktemp -d)
    git clone https://aur.archlinux.org/yay.git "$tmp_dir/yay" || return 1
    
    (
        cd "$tmp_dir/yay" || exit 1
        makepkg -si --noconfirm || exit 1
    )
    
    local res=$?
    rm -rf "$tmp_dir"
    return $res
}

# Install a single package using the system package manager or alternative method
install_package() {
    local pkg="$1"
    local cmd=""
    local label=""

    # 1. Check for alternative installation method first
    local alt_method
    alt_method=$(get_alt_install_method "$pkg")

    if [[ -n "$alt_method" ]]; then
        local method="${alt_method%%:*}"
        local target="${alt_method#*:}"

        case "$method" in
            npm)
                if ! command -v npm >/dev/null 2>&1; then
                    gum style --foreground "$THEME_SECONDARY" "Runtime 'node' missing for $pkg. Installing..."
                    install_package "node" || return 1
                fi
                cmd="npm install -g $target"
                label="npm: installing $pkg"
                ;;
            corepack)
                if ! command -v corepack >/dev/null 2>&1 && ! command -v npm >/dev/null 2>&1; then
                    gum style --foreground "$THEME_SECONDARY" "Runtime 'node' missing for $pkg. Installing..."
                    install_package "node" || return 1
                fi
                
                if command -v corepack >/dev/null 2>&1; then
                    cmd="corepack enable $target"
                    label="Corepack: enabling $pkg"
                else
                    cmd="npm install -g $target"
                    label="npm: installing $pkg (corepack unavailable)"
                fi
                ;;
            pip)
                if ! command -v pip >/dev/null 2>&1 && ! command -v pip3 >/dev/null 2>&1; then
                    gum style --foreground "$THEME_SECONDARY" "Runtime 'python' missing for $pkg. Installing..."
                    install_package "python" || return 1
                fi
                local pip_cmd="pip"
                command -v pip3 >/dev/null 2>&1 && pip_cmd="pip3"
                cmd="$pip_cmd install --user $target"
                label="pip: installing $pkg"
                ;;
            native)
                gum style --foreground "$THEME_SECONDARY" "Using native installer for $pkg..."
                if eval "$target"; then
                    return 0
                else
                    gum style --foreground "$THEME_ERROR" "Native installer failed for $pkg"
                    return 1
                fi
                ;;
            manual)
                gum style --foreground "$THEME_WARNING" "No package for $pkg on $DISTRO"
                gum style --foreground "$THEME_SUBTEXT" "  Install manually: $target"
                return 0  # Not a failure, just informational
                ;;
        esac
    fi

    # 2. Resolve Command based on OS (if no alt method or alt method set cmd)
    if [[ -z "$cmd" ]]; then
        if [[ "$OS" == "macos" ]]; then
            local brew_args
            brew_args=$(get_brew_pkg "$pkg")
            if [[ -n "$brew_args" ]]; then
                cmd="brew install $brew_args"
                label="Brew: installing $pkg"
            fi
        elif [[ "$DISTRO" == "arch" ]]; then
            local pacman_pkg
            pacman_pkg=$(get_pacman_pkg "$pkg")
            if [[ -n "$pacman_pkg" ]]; then
                if [[ "$pacman_pkg" == aur:* ]]; then
                    local aur_pkg="${pacman_pkg#aur:}"
                    if ! command -v yay >/dev/null 2>&1 && ! command -v paru >/dev/null 2>&1; then
                        bootstrap_aur_helper || return 1
                    fi

                    if command -v yay >/dev/null 2>&1; then
                        cmd="yay -S --noconfirm --needed $aur_pkg"
                        label="AUR (yay): installing $pkg"
                    elif command -v paru >/dev/null 2>&1; then
                        cmd="paru -S --noconfirm --needed $aur_pkg"
                        label="AUR (paru): installing $pkg"
                    fi
                else
                    cmd="sudo pacman -S --noconfirm --needed $pacman_pkg"
                    label="Pacman: installing $pkg"
                fi
            fi
        elif [[ "$DISTRO" == "debian" ]]; then
            local apt_pkg
            apt_pkg=$(get_apt_pkg "$pkg")
            if [[ -n "$apt_pkg" ]]; then
                ensure_apt_fresh
                cmd="sudo apt install -y $apt_pkg"
                label="Apt: installing $pkg"
            fi
        fi
    fi

    # 3. Execute with Spinner
    if [[ -n "$cmd" ]]; then
        local -a cmd_parts
        read -ra cmd_parts <<< "$cmd"
        if gum spin --spinner dot --title "$label" -- "${cmd_parts[@]}"; then
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
# Works with stow 2.3.x AND 2.4+ (different error message formats)
check_stow_conflicts() {
    local pkg="$1"
    local stow_output

    # Capture all output (verbose=2 for detailed conflict info)
    stow_output=$(LC_ALL=C stow --no --verbose=2 \
        --dir="$DOTFILES_DIR" --target="$HOME" "$pkg" 2>&1) || true

    # Version-agnostic: check for ANY conflict indicator
    if echo "$stow_output" | grep -qE "would cause conflicts|existing target|cannot stow"; then
        # Extract paths using multiple patterns for different stow versions:
        # - stow 2.3.x: "existing target is not a symlink: path"
        # - stow 2.4+:  "cannot stow ... over existing target path since ..."
        echo "$stow_output" | \
            grep -E "(existing target|cannot stow)" | \
            sed -E 's/.*existing target is not a symlink: ([^ ]+).*/\1/' | \
            sed -E 's/.*over existing target ([^ ]+) since.*/\1/' | \
            grep -v "^$" | sort -u
    fi
}

# Check if a package's configs are already stowed (symlinks exist and point to dotfiles)
# Usage: is_stowed "package_name"
# Returns: 0 if fully stowed, 1 if not stowed or partial
is_stowed() {
    local pkg="$1"
    local pkg_dir="$DOTFILES_DIR/$pkg"

    [[ ! -d "$pkg_dir" ]] && return 1

    # Use stow's dry-run to check if any links would be created
    # LINK: appears when stow would create a new symlink
    # Skipping appears when symlink already exists and points correctly
    local output
    output=$(stow --no --verbose --dir="$DOTFILES_DIR" --target="$HOME" "$pkg" 2>&1)

    # If LINK: appears, package needs stowing (not fully stowed)
    if echo "$output" | grep -q "^LINK:"; then
        return 1  # Not stowed
    fi

    # No LINK: means nothing to do - already stowed
    return 0
}

# Stow a package (link configs)
# Usage: stow_package "package_name" "backup_timestamp"
# Returns: 0 on newly linked, 1 on failure, 2 if no config to stow, 3 if already linked
stow_package() {
    local pkg="$1"
    local timestamp="${2:-}"

    if [[ ! -d "$DOTFILES_DIR/$pkg" ]]; then
        # Brew-only package, nothing to stow
        return 2
    fi

    # 0. Check if already stowed
    if is_stowed "$pkg"; then
        return 3
    fi

    # 1. Check for conflicts
    local conflicts
    conflicts=$(check_stow_conflicts "$pkg")

    if [[ -n "$conflicts" ]]; then
        gum style --foreground "$THEME_WARNING" "Conflicts detected for $pkg:"
        echo "$conflicts" | while IFS= read -r file; do
            [[ -n "$file" ]] && gum style --foreground "$THEME_SUBTEXT" "    - $file"
        done
        echo ""
        if ui_confirm "Backup these files and proceed?"; then
             backup_conflicts "$pkg" "$conflicts" "$timestamp"
        else
            gum style --foreground "$THEME_ERROR" "Skipping $pkg (conflicts)"
            return 1
        fi
    fi

    # 2. Stow
    if stow --dir="$DOTFILES_DIR" --target="$HOME" --restow "$pkg" 2>/dev/null; then
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
    local bin_name
    bin_name=$(get_binary_name "$pkg")
    
    # 1. Simple command check
    if command -v "$bin_name" >/dev/null 2>&1; then
        return 0
    fi

    # 2. Check MacOS Applications
    if [[ "$OS" == "macos" ]]; then
        case "$pkg" in
            aerospace) [[ -d "/Applications/AeroSpace.app" || -d "$HOME/Applications/AeroSpace.app" ]] && return 0 ;;
            autoraise) [[ -d "/Applications/AutoRaise.app" || -d "$HOME/Applications/AutoRaise.app" ]] && return 0 ;;
            bitwarden) [[ -d "/Applications/Bitwarden.app" || -d "$HOME/Applications/Bitwarden.app" ]] && return 0 ;;
            ghostty)   [[ -d "/Applications/Ghostty.app" || -d "$HOME/Applications/Ghostty.app" ]] && return 0 ;;
            karabiner) [[ -d "/Applications/Karabiner-Elements.app" || -d "$HOME/Applications/Karabiner-Elements.app" ]] && return 0 ;;
            localsend) [[ -d "/Applications/LocalSend.app" || -d "$HOME/Applications/LocalSend.app" ]] && return 0 ;;
            raycast)   [[ -d "/Applications/Raycast.app" || -d "$HOME/Applications/Raycast.app" ]] && return 0 ;;
        esac
    fi

    return 1
}
