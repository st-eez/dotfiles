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
    gum style --foreground "$THEME_PRIMARY" "  ◆ Setting up Starship prompt..."

    if command -v starship >/dev/null 2>&1; then
        gum style --foreground "$THEME_SUBTEXT" "  Starship already installed"
    else
        gum style --foreground "$THEME_WARNING" "  Starship binary not found"
        if gum confirm --prompt.foreground="$THEME_TEXT" "Install Starship now?"; then
            install_package "starship" || return 1
        else
            gum style --foreground "$THEME_ERROR" "  Starship required for prompt"
            return 1
        fi
    fi

    if [[ -d "$DOTFILES_DIR/starship" ]]; then
        local stow_result
        stow_package "starship"
        stow_result=$?
        case $stow_result in
            0) gum style --foreground "$THEME_SUCCESS" "  Config linked" ;;
            3) gum style --foreground "$THEME_SUBTEXT" "  Config already linked" ;;
            *) return 1 ;;
        esac
    fi

    if [[ -f "$HOME/.zshrc" && ! -L "$HOME/.zshrc" ]]; then
        if ! grep -q 'starship init zsh' "$HOME/.zshrc"; then
            echo '' >> "$HOME/.zshrc"
            echo '# Initialize Starship prompt' >> "$HOME/.zshrc"
            echo 'eval "$(starship init zsh)"' >> "$HOME/.zshrc"
            gum style --foreground "$THEME_SUCCESS" "  Added starship init to ~/.zshrc"
        fi
    fi

    gum style --foreground "$THEME_SUCCESS" "  Starship configured"
    return 0
}

setup_zsh_env() {
    gum style --foreground "$THEME_PRIMARY" "  ◆ Setting up Zsh environment..."

    local zsh_custom="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}"
    local changes_made=false

    # 1. Oh-My-Zsh
    if [[ ! -d "$HOME/.oh-my-zsh" ]]; then
        gum style --foreground "$THEME_SECONDARY" "  Installing Oh-My-Zsh..."
        if ! sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended --keep-zshrc; then
            gum style --foreground "$THEME_ERROR" "  Failed to install Oh-My-Zsh"
            return 1
        fi
        changes_made=true
    fi

    # 2. Plugins
    local plugins_dir="$zsh_custom/plugins"
    mkdir -p "$plugins_dir"

    if [[ ! -d "$plugins_dir/zsh-autosuggestions" ]]; then
        gum style --foreground "$THEME_SECONDARY" "  Installing zsh-autosuggestions..."
        if ! git clone --quiet https://github.com/zsh-users/zsh-autosuggestions "$plugins_dir/zsh-autosuggestions"; then
            gum style --foreground "$THEME_ERROR" "  Failed to clone zsh-autosuggestions"
            return 1
        fi
        changes_made=true
    fi

    if [[ ! -d "$plugins_dir/zsh-syntax-highlighting" ]]; then
        gum style --foreground "$THEME_SECONDARY" "  Installing zsh-syntax-highlighting..."
        if ! git clone --quiet https://github.com/zsh-users/zsh-syntax-highlighting "$plugins_dir/zsh-syntax-highlighting"; then
             gum style --foreground "$THEME_ERROR" "  Failed to clone zsh-syntax-highlighting"
             return 1
        fi
        changes_made=true
    fi

    # 3. Aliases file (skip if symlink exists from stow)
    if [[ ! -e "$zsh_custom/aliases.zsh" && ! -L "$zsh_custom/aliases.zsh" ]]; then
        if ! touch "$zsh_custom/aliases.zsh"; then
             gum style --foreground "$THEME_ERROR" "  Failed to create aliases.zsh"
             return 1
        fi
        changes_made=true
    fi

    # 4. Change default shell (optional, won't fail setup)
    change_default_shell

    # 5. P10k migration + Starship setup
    if detect_p10k; then
        migrate_p10k_to_starship
    fi
    setup_starship || true

    # Summary
    if [[ "$changes_made" == true ]]; then
        gum style --foreground "$THEME_SUCCESS" "  Zsh environment configured"
    else
        gum style --foreground "$THEME_SUBTEXT" "  Already configured"
    fi

    return 0
}