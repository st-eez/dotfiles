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
    tmp_dir=$(mktemp -d) || return 1

    # Save original traps and set cleanup trap for this function
    local old_int_trap old_term_trap
    old_int_trap=$(trap -p INT)
    old_term_trap=$(trap -p TERM)

    # Cleanup helper for interrupt handling
    _aur_cleanup() { [[ -n "${tmp_dir:-}" ]] && rm -rf "$tmp_dir"; }

    # Trap INT/TERM to cleanup temp dir before propagating signal
    trap '_aur_cleanup; trap - INT TERM; kill -INT $$' INT
    trap '_aur_cleanup; trap - INT TERM; kill -TERM $$' TERM

    local build_success=0

    if ! git clone https://aur.archlinux.org/yay.git "$tmp_dir/yay"; then
        build_success=1
    elif ! (cd "$tmp_dir/yay" && makepkg -si --noconfirm); then
        build_success=1
    fi

    # Restore original traps and cleanup
    eval "${old_int_trap:-trap - INT}"
    eval "${old_term_trap:-trap - TERM}"
    _aur_cleanup
    unset -f _aur_cleanup
    return $build_success
}

# Install Node.js via NodeSource (Debian/Ubuntu/Mint)
# System repos have Node 18; npm packages like gemini/codex need Node 20+
install_node_nodesource() {
    gum style --foreground "$THEME_SECONDARY" "  Adding NodeSource repo for Node 20..."

    # Add NodeSource repo
    if ! curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1; then
        gum style --foreground "$THEME_ERROR" "  Failed to add NodeSource repo"
        return 1
    fi

    # Install Node.js
    gum style --foreground "$THEME_SECONDARY" "  Installing Node.js 20..."
    if ! sudo apt install -y nodejs >/dev/null 2>&1; then
        gum style --foreground "$THEME_ERROR" "  Failed to install Node.js"
        return 1
    fi

    gum style --foreground "$THEME_SUCCESS" "  Installed Node.js $(node --version)"
    return 0
}

# Install Neovim from official tarball (Debian/Ubuntu)
# Ubuntu/Mint repos ship outdated versions; LazyVim v15 requires 0.11.2+
install_nvim_tarball() {
    local version="0.11.2"
    local arch
    arch=$(uname -m)

    # Map uname arch to release asset name
    case "$arch" in
        x86_64)  arch="x86_64" ;;
        aarch64) arch="arm64" ;;
        *)
            gum style --foreground "$THEME_ERROR" "  Unsupported architecture: $arch"
            return 1
            ;;
    esac

    local url="https://github.com/neovim/neovim/releases/download/v${version}/nvim-linux-${arch}.tar.gz"
    local install_dir="$HOME/.local"
    local extract_dir="$install_dir/nvim-linux-${arch}"
    local tarball
    tarball=$(mktemp) || return 1

    # Ensure ~/.local/bin exists (for symlink)
    mkdir -p "$install_dir/bin"

    # Download with spinner
    if ! gum spin --spinner dot --title "Downloading neovim v${version}..." -- \
        curl -fsSL -o "$tarball" "$url"; then
        rm -f "$tarball"
        gum style --foreground "$THEME_ERROR" "  Failed to download neovim v${version}"
        return 1
    fi

    # Remove old extraction if exists (clean upgrade)
    [[ -d "$extract_dir" ]] && rm -rf "$extract_dir"

    # Extract with spinner
    if ! gum spin --spinner dot --title "Extracting neovim..." -- \
        tar -C "$install_dir" -xzf "$tarball"; then
        rm -f "$tarball"
        gum style --foreground "$THEME_ERROR" "  Failed to extract neovim"
        return 1
    fi

    rm -f "$tarball"

    # Symlink to ~/.local/bin/nvim
    ln -sf "$extract_dir/bin/nvim" "$install_dir/bin/nvim"

    gum style --foreground "$THEME_SUCCESS" "  Installed neovim v${version} to ~/.local"
    return 0
}

# Install Ghostty via AppImage (Debian/Ubuntu/Mint)
# Source: https://github.com/pkgforge-dev/ghostty-appimage (community-maintained)
# See: https://ghostty.org/docs/install/binary
install_ghostty_appimage() {
    local install_dir="$HOME/.local/bin"

    # 1. Get latest release version
    gum style --foreground "$THEME_SECONDARY" "  Fetching latest Ghostty AppImage..."
    local version
    version=$(curl -fsSL "https://api.github.com/repos/pkgforge-dev/ghostty-appimage/releases/latest" | \
        grep -oP '"tag_name":\s*"\K[^"]+' 2>/dev/null)
    if [[ -z "$version" ]]; then
        gum style --foreground "$THEME_ERROR" "  Failed to get AppImage version"
        return 1
    fi
    local version_num="${version#v}"
    gum style --foreground "$THEME_SUBTEXT" "  Latest: $version"

    # 2. Determine CPU architecture
    local arch
    arch=$(uname -m)
    case "$arch" in
        x86_64|aarch64) ;;
        *)
            gum style --foreground "$THEME_ERROR" "  Unsupported architecture: $arch"
            return 1
            ;;
    esac

    # 3. Download AppImage
    local url="https://github.com/pkgforge-dev/ghostty-appimage/releases/download/${version}/Ghostty-${version_num}-${arch}.AppImage"
    gum style --foreground "$THEME_SECONDARY" "  Downloading..."
    mkdir -p "$install_dir"
    if ! curl --connect-timeout 15 --max-time 300 -fSL -o "$install_dir/ghostty" "$url"; then
        gum style --foreground "$THEME_ERROR" "  Failed to download AppImage"
        return 1
    fi

    # 4. Make executable
    chmod +x "$install_dir/ghostty"

    gum style --foreground "$THEME_SUCCESS" "  Installed Ghostty to ~/.local/bin"
    return 0
}

# Post-install setup for Ghostty on Debian/Ubuntu/Mint
# Creates .desktop entry and ensures PATH is set
setup_opencode_plugins() {
    local opencode_dir="$HOME/.config/opencode"
    
    if [[ ! -f "$opencode_dir/package.json" ]]; then
        return 0
    fi

    gum style --foreground "$THEME_PRIMARY" "  ◆ Installing OpenCode plugins (oh-my-opencode)..."

    if command -v bun >/dev/null 2>&1; then
        if gum spin --spinner dot --title "Running bun install..." -- \
            bash -c "cd '$opencode_dir' && bun install"; then
            gum style --foreground "$THEME_SUCCESS" "  Plugins installed"
            return 0
        else
            gum style --foreground "$THEME_ERROR" "  Failed to install plugins"
            return 1
        fi
    elif command -v npm >/dev/null 2>&1; then
        if gum spin --spinner dot --title "Running npm install..." -- \
            bash -c "cd '$opencode_dir' && npm install"; then
            gum style --foreground "$THEME_SUCCESS" "  Plugins installed"
            return 0
        else
            gum style --foreground "$THEME_ERROR" "  Failed to install plugins"
            return 1
        fi
    else
        gum style --foreground "$THEME_WARNING" "  Neither bun nor npm found - run 'bun i' in ~/.config/opencode/ manually"
        return 0
    fi
}

setup_ghostty_desktop() {
    gum style --foreground "$THEME_PRIMARY" "  ◆ Setting up Ghostty desktop integration..."

    local modified=false

    # 1. Create desktop entry for app menu
    local desktop_dir="$HOME/.local/share/applications"
    if [[ ! -f "$desktop_dir/ghostty.desktop" ]]; then
        mkdir -p "$desktop_dir"
        cat > "$desktop_dir/ghostty.desktop" << EOF
[Desktop Entry]
Name=Ghostty
Comment=A fast, feature-rich terminal emulator
Exec=$HOME/.local/bin/ghostty
Icon=utilities-terminal
Terminal=false
Type=Application
Categories=System;TerminalEmulator;
EOF
        modified=true
    fi

    # 2. Ensure ~/.local/bin is in PATH for bash users
    local path_line='export PATH="$HOME/.local/bin:$PATH"'
    if [[ -f "$HOME/.bashrc" ]] && ! grep -q '\.local/bin' "$HOME/.bashrc"; then
        echo "" >> "$HOME/.bashrc"
        echo "# Added by dotfiles installer" >> "$HOME/.bashrc"
        echo "$path_line" >> "$HOME/.bashrc"
        modified=true
    fi

    if [[ "$modified" == true ]]; then
        gum style --foreground "$THEME_SUCCESS" "  Desktop integration configured"
    else
        gum style --foreground "$THEME_SUBTEXT" "  Already configured"
    fi
    return 0
}

# Merge nvim plugins into Omarchy's config
# Strategy: Copy ALL user plugins EXCEPT theme-related ones (blacklist approach)
# Returns: 0 on success, 1 on any failure
merge_nvim_plugins() {
    # Save and set nullglob for safe glob expansion
    local old_nullglob
    old_nullglob=$(shopt -p nullglob)
    shopt -s nullglob

    # Verify DOTFILES_DIR is set (should be set by install.sh)
    if [[ -z "${DOTFILES_DIR:-}" ]]; then
        gum style --foreground "${THEME_ERROR:-#f7768e}" "  DOTFILES_DIR not set - cannot merge"
        eval "$old_nullglob"
        return 1
    fi

    local src_plugins="$DOTFILES_DIR/nvim/.config/nvim/lua/plugins"
    local dst_plugins="${HOME:?}/.config/nvim/lua/plugins"

    # Verify source exists
    if [[ ! -d "$src_plugins" ]]; then
        gum style --foreground "${THEME_WARNING:-#e0af68}" "  No nvim plugins found in dotfiles"
        eval "$old_nullglob"
        return 0
    fi

    # Ensure destination directory exists
    if [[ ! -d "$dst_plugins" ]]; then
        gum style --foreground "${THEME_WARNING:-#e0af68}" "  Omarchy nvim plugins dir missing, skipping merge"
        eval "$old_nullglob"
        return 0
    fi

    # Blacklist: files that conflict with Omarchy's theme system or are templates
    # These are the ONLY files we skip - everything else is copied
    local -a blacklist=(tokyonight.lua example.lua)

    # Counters - declared at function scope
    local copied=0
    local skipped=0
    local unchanged=0
    local failures=0
    local src filename dst is_blacklisted blocked

    # Iterate over ALL .lua files in source plugins directory
    for src in "$src_plugins"/*.lua; do
        filename="${src##*/}"
        dst="$dst_plugins/$filename"

        # Skip blacklisted files
        is_blacklisted=false
        for blocked in "${blacklist[@]}"; do
            if [[ "$filename" == "$blocked" ]]; then
                is_blacklisted=true
                gum style --foreground "${THEME_SUBTEXT:-#565f89}" "  Skipped: $filename (preserves Omarchy theming)"
                ((skipped++))
                break
            fi
        done
        [[ "$is_blacklisted" == true ]] && continue

        # Compare and copy if different or new
        if [[ -f "$dst" ]]; then
            if cmp -s "$src" "$dst"; then
                ((unchanged++))
            else
                # File differs - overwrite with user's version
                if cp "$src" "$dst"; then
                    gum style --foreground "${THEME_SUCCESS:-#9ece6a}" "  Updated: $filename"
                    ((copied++))
                else
                    gum style --foreground "${THEME_ERROR:-#f7768e}" "  Failed to update: $filename"
                    ((failures++))
                fi
            fi
        else
            # New file - copy it
            if cp "$src" "$dst"; then
                gum style --foreground "${THEME_SUCCESS:-#9ece6a}" "  Copied: $filename"
                ((copied++))
            else
                gum style --foreground "${THEME_ERROR:-#f7768e}" "  Failed to copy: $filename"
                ((failures++))
            fi
        fi
    done

    # Summary
    if ((failures > 0)); then
        gum style --foreground "${THEME_ERROR:-#f7768e}" "  Summary: $copied copied/updated, $unchanged unchanged, $skipped skipped, $failures FAILED"
    else
        gum style --foreground "${THEME_SUBTEXT:-#565f89}" "  Summary: $copied copied/updated, $unchanged unchanged, $skipped skipped"
    fi

    # Language extras reminder - only show on first run (when we copied something)
    if [[ $copied -gt 0 ]]; then
        echo ""
        gum style --foreground "${THEME_SECONDARY:-#7dcfff}" "  ┌─ MANUAL STEP ─────────────────────────────────┐"
        gum style --foreground "${THEME_SUBTEXT:-#565f89}"   "  │ Add language extras to Omarchy's lazy.lua:   │"
        gum style --foreground "${THEME_SUBTEXT:-#565f89}"   "  │   ~/.config/nvim/lua/config/lazy.lua         │"
        gum style --foreground "${THEME_SUBTEXT:-#565f89}"   "  │                                              │"
        gum style --foreground "${THEME_SUBTEXT:-#565f89}"   "  │ Your extras:                                 │"
        gum style --foreground "${THEME_SUBTEXT:-#565f89}"   "  │   lazyvim.plugins.extras.lang.typescript     │"
        gum style --foreground "${THEME_SUBTEXT:-#565f89}"   "  │   lazyvim.plugins.extras.lang.json           │"
        gum style --foreground "${THEME_SUBTEXT:-#565f89}"   "  │   lazyvim.plugins.extras.lang.python         │"
        gum style --foreground "${THEME_SUBTEXT:-#565f89}"   "  │   lazyvim.plugins.extras.lang.yaml           │"
        gum style --foreground "${THEME_SUBTEXT:-#565f89}"   "  │   lazyvim.plugins.extras.lang.docker         │"
        gum style --foreground "${THEME_SUBTEXT:-#565f89}"   "  │   lazyvim.plugins.extras.lang.toml           │"
        gum style --foreground "${THEME_SUBTEXT:-#565f89}"   "  │   lazyvim.plugins.extras.lang.markdown       │"
        gum style --foreground "${THEME_SECONDARY:-#7dcfff}" "  └───────────────────────────────────────────────┘"
    fi

    # Restore nullglob and return
    eval "$old_nullglob"
    ((failures > 0)) && return 1
    return 0
}

# Add user's Ghostty preferences via include file
# Preserves Omarchy theme switching while adding user settings
# Returns: 0 on success/skip, 1 on failure
setup_ghostty_steez_config() {
    local ghostty_dir="${HOME:?}/.config/ghostty"
    local ghostty_config="$ghostty_dir/config"
    local steez_config="$ghostty_dir/steez.conf"
    local src_config="${DOTFILES_DIR:-}/ghostty/.config/ghostty/config"

    # Verify DOTFILES_DIR is set
    if [[ -z "${DOTFILES_DIR:-}" ]]; then
        gum style --foreground "${THEME_ERROR:-#f7768e}" "  DOTFILES_DIR not set - cannot setup ghostty"
        return 1
    fi

    # Verify source exists
    if [[ ! -f "$src_config" ]]; then
        gum style --foreground "${THEME_SUBTEXT:-#565f89}" "  No ghostty config in dotfiles"
        return 0
    fi

    # Verify Omarchy ghostty config exists
    if [[ ! -f "$ghostty_config" ]]; then
        gum style --foreground "${THEME_WARNING:-#e0af68}" "  Omarchy ghostty config not found"
        return 0
    fi

    # Extract user preferences (skip theme and font-family which Omarchy manages)
    local new_content
    new_content=$(cat <<EOF
# Steez dotfiles - user preferences
# Auto-generated from dotfiles - will be regenerated on each install run

$(grep -E "^(font-size|keybind|split-|unfocused-split-|clipboard-|background-opacity)" "$src_config" 2>/dev/null || true)
EOF
)

    # Check for keybind conflicts and warn user
    local user_keybinds omarchy_keybinds conflicts
    user_keybinds=$(grep -oE "^keybind = [^=]+" "$src_config" 2>/dev/null | sort -u)
    omarchy_keybinds=$(grep -oE "^keybind = [^=]+" "$ghostty_config" 2>/dev/null | sort -u)
    if [[ -n "$user_keybinds" && -n "$omarchy_keybinds" ]]; then
        conflicts=$(comm -12 <(echo "$user_keybinds") <(echo "$omarchy_keybinds"))
        if [[ -n "$conflicts" ]]; then
            gum style --foreground "${THEME_WARNING:-#e0af68}" "  Note: Overriding Omarchy keybinds: $(echo "$conflicts" | tr '\n' ' ')"
        fi
    fi

    # Create or update steez.conf
    if [[ -f "$steez_config" ]]; then
        # Check if content changed
        local old_content
        old_content=$(<"$steez_config")
        if [[ "$new_content" == "$old_content" ]]; then
            gum style --foreground "${THEME_SUBTEXT:-#565f89}" "  steez.conf unchanged"
        else
            if printf '%s\n' "$new_content" > "$steez_config"; then
                gum style --foreground "${THEME_SUCCESS:-#9ece6a}" "  Updated steez.conf with latest preferences"
            else
                gum style --foreground "${THEME_ERROR:-#f7768e}" "  Failed to update steez.conf"
                return 1
            fi
        fi
    else
        if printf '%s\n' "$new_content" > "$steez_config"; then
            gum style --foreground "${THEME_SUCCESS:-#9ece6a}" "  Created steez.conf with user preferences"
        else
            gum style --foreground "${THEME_ERROR:-#f7768e}" "  Failed to create steez.conf"
            return 1
        fi
    fi

    # Track if we need to modify ghostty config (for atomic update)
    local needs_steez_include=false
    local needs_zsh_command=false
    local zsh_path=""

    # Check if steez.conf include needed (precise pattern match)
    if ! grep -qE "^config-file[[:space:]]*=.*steez\.conf" "$ghostty_config"; then
        needs_steez_include=true
    else
        gum style --foreground "${THEME_SUBTEXT:-#565f89}" "  steez.conf already included"
    fi

    # Check zsh configuration needed
    # First, find zsh path (check known paths before falling back to PATH)
    for p in /usr/bin/zsh /bin/zsh /usr/local/bin/zsh /opt/homebrew/bin/zsh; do
        [[ -x "$p" ]] && { zsh_path="$p"; break; }
    done
    [[ -z "$zsh_path" ]] && zsh_path=$(command -v zsh 2>/dev/null)

    if [[ -n "$zsh_path" ]]; then
        if grep -qE "^command[[:space:]]*=.*zsh" "$ghostty_config"; then
            gum style --foreground "${THEME_SUBTEXT:-#565f89}" "  Ghostty already configured for zsh"
        elif grep -qE "^command[[:space:]]*=" "$ghostty_config"; then
            gum style --foreground "${THEME_WARNING:-#e0af68}" "  Ghostty has different shell - not modifying"
        else
            needs_zsh_command=true
        fi
    else
        gum style --foreground "${THEME_SUBTEXT:-#565f89}" "  Zsh not installed - skipping shell config"
    fi

    # If modifications needed, do atomic update via temp file
    if [[ "$needs_steez_include" == true || "$needs_zsh_command" == true ]]; then
        # Backup before modification
        local backup_file="${ghostty_config}.steez-backup.$(date +%Y%m%d_%H%M%S)"
        if ! cp "$ghostty_config" "$backup_file"; then
            gum style --foreground "${THEME_ERROR:-#f7768e}" "  Failed to backup ghostty config"
            return 1
        fi
        gum style --foreground "${THEME_SUBTEXT:-#565f89}" "  Backed up config to ${backup_file##*/}"

        # Create temp file with modifications (same dir = atomic mv, -p = preserve perms)
        local tmp_config
        tmp_config=$(mktemp "$ghostty_dir/.tmp.XXXXXX") || return 1
        cp -p "$ghostty_config" "$tmp_config" || { rm -f "$tmp_config"; return 1; }

        if [[ "$needs_steez_include" == true ]]; then
            {
                echo ""
                echo "# Steez: User preferences (font-size, keybinds, etc.)"
                echo "config-file = $steez_config"
            } >> "$tmp_config"
        fi

        if [[ "$needs_zsh_command" == true ]]; then
            {
                echo ""
                echo "# Steez: Launch zsh in terminal (bash remains login shell for Omarchy)"
                echo "command = $zsh_path"
            } >> "$tmp_config"
        fi

        # Atomic replace
        if mv "$tmp_config" "$ghostty_config"; then
            [[ "$needs_steez_include" == true ]] && \
                gum style --foreground "${THEME_SUCCESS:-#9ece6a}" "  Added steez.conf include to ghostty config"
            [[ "$needs_zsh_command" == true ]] && \
                gum style --foreground "${THEME_SUCCESS:-#9ece6a}" "  Added 'command = $zsh_path' to Ghostty"
        else
            gum style --foreground "${THEME_ERROR:-#f7768e}" "  Failed to update ghostty config"
            rm -f "$tmp_config"
            return 1
        fi
    fi

    return 0
}

# Install Nerd Fonts (JetBrains Mono) for proper icon support
install_nerd_fonts() {
    gum style --foreground "$THEME_PRIMARY" "  ◆ Setting up Nerd Fonts..."

    # Omarchy ships with JetBrainsMono Nerd Font pre-installed
    if [[ "${IS_OMARCHY:-false}" == true ]]; then
        if command -v fc-list >/dev/null 2>&1; then
            if fc-list 2>/dev/null | grep -qi "JetBrainsMono.*Nerd"; then
                gum style --foreground "$THEME_SUBTEXT" "  Already installed"
                return 0
            fi
        else
            if pacman -Qi ttf-jetbrains-mono-nerd &>/dev/null; then
                gum style --foreground "$THEME_SUBTEXT" "  Already installed"
                return 0
            fi
        fi
    fi

    if [[ "$OS" == "macos" ]]; then
        if brew list --cask font-jetbrains-mono-nerd-font &>/dev/null; then
            gum style --foreground "$THEME_SUBTEXT" "  Already installed"
        else
            gum style --foreground "$THEME_SECONDARY" "  Installing JetBrainsMono Nerd Font..."
            gum spin --spinner dot --title "Brew: installing font-jetbrains-mono-nerd-font" -- \
                brew install --cask font-jetbrains-mono-nerd-font
            gum style --foreground "$THEME_SUCCESS" "  Installed"
        fi
    elif [[ "$DISTRO" == "arch" ]]; then
        if pacman -Qi ttf-jetbrains-mono-nerd &>/dev/null; then
            gum style --foreground "$THEME_SUBTEXT" "  Already installed"
        else
            if ! command -v yay >/dev/null 2>&1 && ! command -v paru >/dev/null 2>&1; then
                bootstrap_aur_helper || return 1
            fi

            local aur_helper="yay"
            command -v paru >/dev/null 2>&1 && aur_helper="paru"

            gum style --foreground "$THEME_SECONDARY" "  Installing JetBrainsMono Nerd Font..."
            gum spin --spinner dot --title "AUR ($aur_helper): installing ttf-jetbrains-mono-nerd" -- \
                "$aur_helper" -S --noconfirm --needed ttf-jetbrains-mono-nerd
            gum style --foreground "$THEME_SUCCESS" "  Installed"
        fi
    elif [[ "$DISTRO" == "debian" ]]; then
        local font_dir="$HOME/.local/share/fonts"
        if compgen -G "$font_dir/JetBrainsMono*NerdFont-*.ttf" > /dev/null; then
            gum style --foreground "$THEME_SUBTEXT" "  Already installed"
            return 0
        fi

        if ! command -v curl >/dev/null 2>&1; then
            gum style --foreground "$THEME_ERROR" "  curl is required for font installation"
            return 1
        fi

        mkdir -p "$font_dir"
        local url="https://github.com/ryanoasis/nerd-fonts/releases/latest/download/JetBrainsMono.tar.xz"
        local tmp_file
        tmp_file=$(mktemp) || return 1

        local fc_cmd="true"
        if command -v fc-cache >/dev/null 2>&1; then
            fc_cmd="fc-cache -f"
        else
            gum style --foreground "$THEME_WARNING" "  fc-cache not found - font cache not updated"
        fi

        gum style --foreground "$THEME_SECONDARY" "  Installing JetBrainsMono Nerd Font..."
        if gum spin --spinner dot --title "Downloading..." -- \
            bash -c "curl -L -f -o '$tmp_file' '$url' && \
                     tar -xf '$tmp_file' -C '$font_dir' && \
                     $fc_cmd"; then
            rm -f "$tmp_file"
            gum style --foreground "$THEME_SUCCESS" "  Installed"
        else
            rm -f "$tmp_file"
            gum style --foreground "$THEME_ERROR" "  Failed to install"
            return 1
        fi
    else
        gum style --foreground "$THEME_WARNING" "  Unsupported OS/Distro: $OS/$DISTRO"
    fi
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
                    gum style --foreground "$THEME_SECONDARY" "Runtime 'npm' missing for $pkg. Installing..."
                    if [[ "$DISTRO" == "arch" ]]; then
                        sudo -v  # Prompt for password before spinner hides it
                        gum spin --spinner dot --title "Pacman: installing npm" -- \
                            sudo pacman -S --noconfirm npm || return 1
                    elif [[ "$DISTRO" == "debian" ]]; then
                        # Debian/Ubuntu/Mint: nodejs and npm are separate packages
                        sudo -v
                        gum spin --spinner dot --title "Apt: installing npm" -- \
                            sudo apt install -y npm || return 1
                    else
                        # macOS: homebrew node includes npm
                        install_package "node" || return 1
                        hash -r
                    fi
                fi
                # On Linux, npm global install requires sudo (prefix is /usr)
                if [[ "$OS" == "linux" ]]; then
                    sudo -v  # Prompt for password before spinner hides it
                    cmd="sudo npm install -g $target"
                else
                    cmd="npm install -g $target"
                fi
                label="npm: installing $pkg"
                ;;
            corepack)
                if ! command -v corepack >/dev/null 2>&1 && ! command -v npm >/dev/null 2>&1; then
                    gum style --foreground "$THEME_SECONDARY" "Runtime 'npm' missing for $pkg. Installing..."
                    if [[ "$DISTRO" == "arch" ]]; then
                        sudo -v  # Prompt for password before spinner hides it
                        gum spin --spinner dot --title "Pacman: installing npm" -- \
                            sudo pacman -S --noconfirm npm || return 1
                    elif [[ "$DISTRO" == "debian" ]]; then
                        # Debian/Ubuntu/Mint: nodejs and npm are separate packages
                        sudo -v
                        gum spin --spinner dot --title "Apt: installing npm" -- \
                            sudo apt install -y npm || return 1
                    else
                        # macOS: homebrew node includes npm
                        install_package "node" || return 1
                        hash -r
                    fi
                fi

                if command -v corepack >/dev/null 2>&1; then
                    if [[ "$OS" == "linux" ]]; then
                        sudo -v
                        cmd="sudo corepack enable $target"
                    else
                        cmd="corepack enable $target"
                    fi
                    label="Corepack: enabling $pkg"
                else
                    if [[ "$OS" == "linux" ]]; then
                        sudo -v
                        cmd="sudo npm install -g $target"
                    else
                        cmd="npm install -g $target"
                    fi
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
    # NOTE: Command string is split on whitespace. Package names with spaces are
    # not supported. All current package names are hardcoded and space-free.
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
        # - stow 2.3.x: "existing target is neither a link nor a directory: path"
        # - stow 2.4+:  "cannot stow ... over existing target path since ..."
        echo "$stow_output" | \
            grep -E "(existing target|cannot stow)" | \
            sed -E 's/.*existing target is not a symlink: ([^ ]+).*/\1/' | \
            sed -E 's/.*existing target is neither a link nor a directory: ([^ ]+).*/\1/' | \
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

    # Omarchy: Special handling for packages with theme integration
    if [[ "${IS_OMARCHY:-false}" == true ]]; then
        case "$pkg" in
            nvim)
                gum style --foreground "${THEME_ACCENT:-#73daca}" \
                    "  Merging nvim plugins (preserving Omarchy theme sync)..."
                merge_nvim_plugins || return 1
                return 3  # "already linked" semantics (no new stow links created)
                ;;
            ghostty)
                gum style --foreground "${THEME_ACCENT:-#73daca}" \
                    "  Setting up Ghostty preferences (preserving Omarchy theme sync)..."
                setup_ghostty_steez_config || return 1
                return 3  # "already linked" semantics
                ;;
            # NOTE: fzf/zoxide not listed - no .config dirs, shell integration only
            # NOTE: aerospace/borders/karabiner/sketchybar not listed - macOS only
        esac
    fi

    # 0. Pre-flight: Check specific critical files
    case "$pkg" in
        zsh)
            if ! ensure_backup "$HOME/.zshrc" "zsh"; then
                 gum style --foreground "$THEME_ERROR" "Backup cancelled. Skipping $pkg config."
                 return 1
            fi
            ;;
    esac

    # 1. Check if already stowed
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
            if ! backup_conflicts "$pkg" "$conflicts" "$timestamp"; then
                gum style --foreground "$THEME_ERROR" "Backup failed - cannot stow $pkg"
                return 1
            fi
        else
            gum style --foreground "$THEME_ERROR" "Skipping $pkg (conflicts)"
            return 1
        fi
    fi

    # 2. Stow (--no-folding for nvim prevents plugins/ dir becoming a symlink)
    local stow_opts="--dir=$DOTFILES_DIR --target=$HOME --restow"
    [[ "$pkg" == "nvim" ]] && stow_opts="$stow_opts --no-folding"
    
    if stow $stow_opts "$pkg" 2>/dev/null; then
        # 3. Post-stow hooks for packages that need additional setup
        case "$pkg" in
            opencode)
                setup_opencode_plugins || return 1
                ;;
        esac
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

    # Special case: nvim requires minimum version for LazyVim
    if [[ "$pkg" == "nvim" && "$DISTRO" == "debian" ]]; then
        if command -v nvim >/dev/null 2>&1; then
            local nvim_ver
            nvim_ver=$(nvim --version | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "0.0.0")
            # Return false (not installed) if version < 0.11.2
            if [[ "$(printf '%s\n' "0.11.2" "$nvim_ver" | sort -V | head -1)" != "0.11.2" ]]; then
                return 1  # Version too old, treat as not installed
            fi
        fi
    fi

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
