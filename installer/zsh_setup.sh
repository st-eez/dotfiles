#!/usr/bin/env bash

# Zsh Environment Setup
# Handles Oh-My-Zsh, plugins, and themes

# Change default login shell to zsh
# Returns: 0 = changed/already zsh, 1 = skipped/declined, 2 = failed
change_default_shell() {
    # Skip if already using zsh
    if [[ "$SHELL" == */zsh ]]; then
        gum style --foreground "$THEME_SUBTEXT" "  Default shell already zsh"
        return 0
    fi

    # Skip for Omarchy (uses Ghostty command workaround)
    if [[ "${IS_OMARCHY:-false}" == true ]]; then
        gum style --foreground "$THEME_SUBTEXT" "  Omarchy detected - keeping bash as login shell"
        return 1
    fi

    # Find zsh path
    local zsh_path=""
    for p in /usr/bin/zsh /bin/zsh /usr/local/bin/zsh /opt/homebrew/bin/zsh; do
        [[ -x "$p" ]] && { zsh_path="$p"; break; }
    done
    [[ -z "$zsh_path" ]] && zsh_path=$(command -v zsh 2>/dev/null)

    if [[ -z "$zsh_path" ]]; then
        gum style --foreground "$THEME_WARNING" "  Zsh not found - cannot change shell"
        return 2
    fi

    # Verify zsh is in /etc/shells
    if ! grep -qx "$zsh_path" /etc/shells 2>/dev/null; then
        gum style --foreground "$THEME_WARNING" "  $zsh_path not in /etc/shells"
        gum style --foreground "$THEME_SUBTEXT" "  Run: sudo sh -c 'echo $zsh_path >> /etc/shells'"
        return 2
    fi

    # Prompt user
    echo ""
    if gum confirm --prompt.foreground="$THEME_TEXT" "Change default shell to zsh? (requires password)"; then
        gum style --foreground "$THEME_SECONDARY" "  Running chsh (enter your password)..."
        if chsh -s "$zsh_path"; then
            gum style --foreground "$THEME_SUCCESS" "  Default shell changed to zsh"
            gum style --foreground "$THEME_SUBTEXT" "  Log out and back in for it to take effect"
            return 0
        else
            gum style --foreground "$THEME_ERROR" "  Failed to change shell"
            gum style --foreground "$THEME_SUBTEXT" "  Try manually: chsh -s $zsh_path"
            return 2
        fi
    else
        gum style --foreground "$THEME_SUBTEXT" "  Skipped - run 'chsh -s $zsh_path' later if desired"
        return 1
    fi
}

# =============================================================================
# ZDOTDIR Bootstrap and Migration
# =============================================================================

# Sets up ZDOTDIR bootstrap in ~/.zshenv
# Returns: 0 on success, 1 on failure
setup_zdotdir() {
    local zshenv="$HOME/.zshenv"
    local zdotdir="${XDG_CONFIG_HOME:-$HOME/.config}/zsh"
    local marker="# steez-dotfiles-zdotdir"

    # Ensure cache directory exists for zcompdump
    mkdir -p "${XDG_CACHE_HOME:-$HOME/.cache}/zsh"

    # Check if already configured
    if [[ -f "$zshenv" ]] && grep -q "$marker" "$zshenv" 2>/dev/null; then
        gum style --foreground "$THEME_SUBTEXT" "  ZDOTDIR already configured"
        return 0
    fi

    gum style --foreground "$THEME_PRIMARY" "  Setting up ZDOTDIR bootstrap..."

    local bootstrap_content
    bootstrap_content=$(cat << 'EOF'
# steez-dotfiles-zdotdir - Zsh environment bootstrap
# Sets ZDOTDIR so zsh loads config from ~/.config/zsh/
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
export ZDOTDIR="$XDG_CONFIG_HOME/zsh"
[[ -f "$ZDOTDIR/.zshenv" ]] && source "$ZDOTDIR/.zshenv"
EOF
)

    if [[ -f "$zshenv" ]]; then
        # Existing .zshenv - prepend our content
        local existing_content
        existing_content=$(<"$zshenv")
        printf '%s\n\n%s\n' "$bootstrap_content" "$existing_content" > "$zshenv"
        gum style --foreground "$THEME_SUCCESS" "  Updated ~/.zshenv (preserved existing content)"
    else
        # No existing .zshenv - create new
        printf '%s\n' "$bootstrap_content" > "$zshenv"
        gum style --foreground "$THEME_SUCCESS" "  Created ~/.zshenv"
    fi

    return 0
}

# Migrates existing machines from old layout to ZDOTDIR
# Returns: 0 on success/no-op, 1 on failure
migrate_zsh_to_zdotdir() {
    local old_zshrc="$HOME/.zshrc"
    local old_zprofile="$HOME/.zprofile"
    local old_plugins_dir="$HOME/.oh-my-zsh/custom/plugins"
    local zdotdir="${XDG_CONFIG_HOME:-$HOME/.config}/zsh"
    local new_plugins_dir="$zdotdir/custom/plugins"

    # Check if old symlinks exist pointing to dotfiles/zsh/
    if [[ -L "$old_zshrc" ]]; then
        local target
        target=$(readlink "$old_zshrc")
        if [[ "$target" == *"dotfiles/zsh/.zshrc"* ]]; then
            gum style --foreground "$THEME_WARNING" "  Migrating from old zsh layout..."

            # Unstow old zsh package
            stow -D -d "$DOTFILES_DIR" -t "$HOME" zsh 2>/dev/null || true

            # Remove old symlinks explicitly (in case stow missed them)
            [[ -L "$old_zshrc" ]] && rm -f "$old_zshrc"
            [[ -L "$old_zprofile" ]] && rm -f "$old_zprofile"
            [[ -L "$HOME/.oh-my-zsh/custom/aliases.zsh" ]] && rm -f "$HOME/.oh-my-zsh/custom/aliases.zsh"
            [[ -L "$HOME/.oh-my-zsh/custom/autoreload.zsh" ]] && rm -f "$HOME/.oh-my-zsh/custom/autoreload.zsh"

            gum style --foreground "$THEME_SUCCESS" "  Removed old layout symlinks"
        fi
    fi

    # Migrate old plugins directory (preserve user-installed plugins)
    if [[ -d "$old_plugins_dir" ]]; then
        mkdir -p "$new_plugins_dir"

        # Move contents, preserving any user-installed plugins
        if [[ "$(ls -A "$old_plugins_dir" 2>/dev/null)" ]]; then
            gum style --foreground "$THEME_SECONDARY" "  Migrating plugins to new location..."
            for plugin in "$old_plugins_dir"/*/; do
                local plugin_name=$(basename "$plugin")
                if [[ ! -d "$new_plugins_dir/$plugin_name" ]]; then
                    mv "$plugin" "$new_plugins_dir/" 2>/dev/null || true
                    gum style --foreground "$THEME_SUBTEXT" "    Moved: $plugin_name"
                fi
            done
        fi

        # Only remove old dir if empty
        rmdir "$old_plugins_dir" 2>/dev/null || true
        gum style --foreground "$THEME_SUCCESS" "  Plugin migration complete"
    fi

    # If ~/.zshrc exists as a regular file, keep it (external tools sink)
    if [[ -f "$old_zshrc" && ! -L "$old_zshrc" ]]; then
        gum style --foreground "$THEME_SUBTEXT" "  Keeping ~/.zshrc for external tool additions"
    fi

    # Re-stow zsh package with new structure
    # This is needed because stow_package() ran BEFORE this migration
    if [[ -z "${DOTFILES_DIR:-}" ]] || [[ ! -d "$DOTFILES_DIR/zsh" ]]; then
        gum style --foreground "$THEME_ERROR" "  Cannot restow: DOTFILES_DIR not set or zsh package missing"
        return 1
    fi

    if ! stow --restow -d "$DOTFILES_DIR" -t "$HOME" zsh; then
        gum style --foreground "$THEME_ERROR" "  Failed to stow zsh config (check for conflicts above)"
        return 1
    fi

    return 0
}

# =============================================================================
# Powerlevel10k Detection and Migration
# =============================================================================

P10K_THEME_DIRS=(
    "$HOME/.oh-my-zsh/custom/themes/powerlevel10k"
    "$HOME/powerlevel10k"
    "$HOME/.powerlevel10k"
)

detect_p10k() {
    for dir in "${P10K_THEME_DIRS[@]}"; do
        [[ -d "$dir" ]] && return 0
    done

    if [[ "$OS" == "macos" ]] && brew list powerlevel10k &>/dev/null; then
        return 0
    fi

    [[ -f "$HOME/.p10k.zsh" ]] && return 0

    if [[ -f "$HOME/.zshrc" ]]; then
        if grep -qE "(ZSH_THEME=.*powerlevel10k|source.*powerlevel10k|p10k-instant-prompt|\.p10k\.zsh)" "$HOME/.zshrc" 2>/dev/null; then
            return 0
        fi
    fi

    compgen -G "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-*" >/dev/null 2>&1 && return 0

    return 1
}

backup_p10k() {
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_base="$DOTFILES_DIR/.backups/p10k-$timestamp"

    mkdir -p "$backup_base"

    if [[ -f "$HOME/.p10k.zsh" && ! -L "$HOME/.p10k.zsh" ]]; then
        cp "$HOME/.p10k.zsh" "$backup_base/"
        gum style --foreground "$THEME_SUBTEXT" "  Backed up: ~/.p10k.zsh"
    fi

    for dir in "${P10K_THEME_DIRS[@]}"; do
        if [[ -d "$dir" ]]; then
            cp -r "$dir" "$backup_base/$(basename "$dir")"
            gum style --foreground "$THEME_SUBTEXT" "  Backed up: $dir"
            break
        fi
    done

    if [[ -f "$HOME/.zshrc" && ! -L "$HOME/.zshrc" ]]; then
        cp "$HOME/.zshrc" "$backup_base/.zshrc"
        gum style --foreground "$THEME_SUBTEXT" "  Backed up: ~/.zshrc"
    fi

    gum style --foreground "$THEME_SUCCESS" "  Backup complete: ${backup_base/$DOTFILES_DIR/\$DOTFILES}"
    return 0
}

clean_zshrc_p10k() {
    local zshrc="$HOME/.zshrc"

    [[ ! -f "$zshrc" ]] && return 0
    [[ -L "$zshrc" ]] && return 0

    sed_inplace '/# Enable Powerlevel10k instant prompt/,/^fi$/d' "$zshrc"
    sed_inplace 's/^ZSH_THEME=.*powerlevel10k.*/ZSH_THEME=""/' "$zshrc"
    sed_inplace '/\[\[.*\.p10k\.zsh.*\]\].*source/d' "$zshrc"
    sed_inplace '/^source.*\.p10k\.zsh/d' "$zshrc"
    sed_inplace '/# To customize prompt, run.*p10k configure/d' "$zshrc"
    sed_inplace '/source.*powerlevel10k.*\.zsh-theme/d' "$zshrc"

    gum style --foreground "$THEME_SUCCESS" "  Cleaned ~/.zshrc"
    return 0
}

migrate_p10k_to_starship() {
    gum style --foreground "$THEME_PRIMARY" "  ◆ Powerlevel10k detected"
    echo ""
    gum style --foreground "$THEME_SUBTEXT" "  ╭─ P10K MIGRATION ─────────────────────────────╮"
    gum style --foreground "$THEME_SUBTEXT" "  │  Powerlevel10k will be replaced by Starship  │"
    gum style --foreground "$THEME_SUBTEXT" "  │                                              │"
    gum style --foreground "$THEME_SUBTEXT" "  │  This will:                                  │"
    gum style --foreground "$THEME_SUBTEXT" "  │    • Backup all p10k files                   │"
    gum style --foreground "$THEME_SUBTEXT" "  │    • Remove p10k from ~/.zshrc               │"
    gum style --foreground "$THEME_SUBTEXT" "  │    • Delete p10k installation                │"
    gum style --foreground "$THEME_SUBTEXT" "  ╰──────────────────────────────────────────────╯"
    echo ""

    if ! gum confirm --prompt.foreground="$THEME_TEXT" "Migrate from Powerlevel10k to Starship?"; then
        gum style --foreground "$THEME_SUBTEXT" "  Skipped - keeping Powerlevel10k"
        return 1
    fi

    backup_p10k || return 1
    clean_zshrc_p10k || return 1

    for dir in "${P10K_THEME_DIRS[@]}"; do
        [[ -d "$dir" ]] && rm -rf "$dir"
    done

    rm -f "$HOME/.p10k.zsh"
    rm -f "${XDG_CACHE_HOME:-$HOME/.cache}"/p10k-instant-prompt-* 2>/dev/null
    rm -rf "${XDG_CACHE_HOME:-$HOME/.cache}/gitstatus" 2>/dev/null

    if [[ "$OS" == "macos" ]] && brew list powerlevel10k &>/dev/null; then
        echo ""
        gum style --foreground "$THEME_SECONDARY" "  ┌─ OPTIONAL ──────────────────────────────────┐"
        gum style --foreground "$THEME_SUBTEXT"   "  │ Uninstall Homebrew package:                 │"
        gum style --foreground "$THEME_SUBTEXT"   "  │   brew uninstall powerlevel10k              │"
        gum style --foreground "$THEME_SECONDARY" "  └──────────────────────────────────────────────┘"
    elif [[ "$DISTRO" == "arch" ]]; then
        local aur_pkg=""
        pacman -Qi powerlevel10k &>/dev/null && aur_pkg="powerlevel10k"
        pacman -Qi powerlevel10k-git &>/dev/null && aur_pkg="powerlevel10k-git"
        if [[ -n "$aur_pkg" ]]; then
            echo ""
            gum style --foreground "$THEME_SECONDARY" "  ┌─ OPTIONAL ──────────────────────────────────┐"
            gum style --foreground "$THEME_SUBTEXT"   "  │ Uninstall AUR package:                      │"
            gum style --foreground "$THEME_SUBTEXT"   "  │   yay -R $aur_pkg                           │"
            gum style --foreground "$THEME_SECONDARY" "  └──────────────────────────────────────────────┘"
        fi
    fi

    gum style --foreground "$THEME_SUCCESS" "  Migration complete"
    return 0
}

setup_starship() {
    local quiet="${1:-false}"
    
    if [[ "$quiet" != "true" ]]; then
        gum style --foreground "$THEME_PRIMARY" "  ◆ Setting up Starship prompt..."
    fi

    if ! command -v starship >/dev/null 2>&1; then
        [[ "$quiet" != "true" ]] && gum style --foreground "$THEME_WARNING" "  Starship binary not found"
        if [[ "$quiet" == "true" ]]; then
            return 1
        fi
        if gum confirm --prompt.foreground="$THEME_TEXT" "Install Starship now?"; then
            install_package "starship" || return 1
        else
            gum style --foreground "$THEME_ERROR" "  Starship required for prompt"
            return 1
        fi
    else
        [[ "$quiet" != "true" ]] && gum style --foreground "$THEME_SUBTEXT" "  Starship already installed"
    fi

    if [[ -d "$DOTFILES_DIR/starship" ]]; then
        local stow_result
        stow_package "starship" >/dev/null 2>&1
        stow_result=$?
        if [[ "$quiet" != "true" ]]; then
            case $stow_result in
                0) gum style --foreground "$THEME_SUCCESS" "  Config linked" ;;
                3) gum style --foreground "$THEME_SUBTEXT" "  Config already linked" ;;
                *) return 1 ;;
            esac
        fi
    fi

    [[ "$quiet" != "true" ]] && gum style --foreground "$THEME_SUCCESS" "  Starship configured"
    return 0
}

setup_zsh_env() {
    local zdotdir="${XDG_CONFIG_HOME:-$HOME/.config}/zsh"
    local zsh_custom="$zdotdir/custom"
    local omz_status="OK"
    local plugins_added=0
    local starship_status="OK"

    # 0. Setup ZDOTDIR bootstrap
    setup_zdotdir || return 1

    # 0.5 Migrate from old layout if needed
    migrate_zsh_to_zdotdir || return 1

    # 1. Oh-My-Zsh (installs to $ZDOTDIR/ohmyzsh)
    local omz_dir="$zdotdir/ohmyzsh"

    # Migrate legacy ~/.oh-my-zsh to new location
    if [[ -d "$HOME/.oh-my-zsh" && ! -d "$omz_dir" ]]; then
        gum style --foreground "$THEME_SECONDARY" "  Migrating Oh-My-Zsh to $zdotdir/ohmyzsh..."
        mv "$HOME/.oh-my-zsh" "$omz_dir"
        omz_status="Migrated"
    fi

    if [[ ! -d "$omz_dir" ]]; then
        export ZDOTDIR="$zdotdir"
        export ZSH="$omz_dir"
        if sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended --keep-zshrc 2>/dev/null; then
            omz_status="Installed"
        else
            post_add "ZSH" "Oh-My-Zsh" "Failed"
            return 1
        fi
    fi
    post_add "ZSH" "Oh-My-Zsh" "$omz_status"

    # 2. Plugins (now under ZDOTDIR/custom/plugins)
    local plugins_dir="$zsh_custom/plugins"
    mkdir -p "$plugins_dir"

    if [[ ! -d "$plugins_dir/zsh-autosuggestions" ]]; then
        if git clone --quiet https://github.com/zsh-users/zsh-autosuggestions "$plugins_dir/zsh-autosuggestions" 2>/dev/null; then
            ((plugins_added++))
        fi
    fi

    if [[ ! -d "$plugins_dir/zsh-syntax-highlighting" ]]; then
        if git clone --quiet https://github.com/zsh-users/zsh-syntax-highlighting "$plugins_dir/zsh-syntax-highlighting" 2>/dev/null; then
            ((plugins_added++))
        fi
    fi

    if [[ $plugins_added -gt 0 ]]; then
        post_add "ZSH" "Plugins" "$plugins_added added"
    else
        post_add "ZSH" "Plugins" "OK"
    fi

    detect_p10k && migrate_p10k_to_starship >/dev/null 2>&1
    if setup_starship "true"; then
        starship_status="OK"
    else
        starship_status="Not configured"
    fi
    post_add "ZSH" "Starship" "$starship_status"

    return 0
}