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

    # Summary
    if [[ "$changes_made" == true ]]; then
        gum style --foreground "$THEME_SUCCESS" "  Zsh environment configured"
    else
        gum style --foreground "$THEME_SUBTEXT" "  Already configured"
    fi

    return 0
}