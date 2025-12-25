#!/usr/bin/env bash

# Zsh Environment Setup
# Handles Oh-My-Zsh, plugins, and themes

setup_zsh_env() {
    gum style --foreground "$THEME_PRIMARY" "  ◆ Setting up Zsh environment..."

    local zsh_custom="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}"

    # 1. Oh-My-Zsh
    if [[ ! -d "$HOME/.oh-my-zsh" ]]; then
        gum style --foreground "$THEME_SECONDARY" "Installing Oh-My-Zsh..."
        # Install non-interactively
        if ! sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended --keep-zshrc; then
            gum style --foreground "$THEME_ERROR" "Failed to install Oh-My-Zsh"
            return 1
        fi
    else
        gum style --foreground "$THEME_SUBTEXT" "  Oh-My-Zsh already installed"
    fi

    # 2. Plugins
    local plugins_dir="$zsh_custom/plugins"
    mkdir -p "$plugins_dir"

    # zsh-autosuggestions
    if [[ ! -d "$plugins_dir/zsh-autosuggestions" ]]; then
        gum style --foreground "$THEME_SECONDARY" "Cloning zsh-autosuggestions..."
        if ! git clone https://github.com/zsh-users/zsh-autosuggestions "$plugins_dir/zsh-autosuggestions"; then
            gum style --foreground "$THEME_ERROR" "Failed to clone zsh-autosuggestions"
            return 1
        fi
    fi

    # zsh-syntax-highlighting
    if [[ ! -d "$plugins_dir/zsh-syntax-highlighting" ]]; then
        gum style --foreground "$THEME_SECONDARY" "Cloning zsh-syntax-highlighting..."
        if ! git clone https://github.com/zsh-users/zsh-syntax-highlighting "$plugins_dir/zsh-syntax-highlighting"; then
             gum style --foreground "$THEME_ERROR" "Failed to clone zsh-syntax-highlighting"
             return 1
        fi
    fi

    # 3. Themes
    local themes_dir="$zsh_custom/themes"
    mkdir -p "$themes_dir"

    # Powerlevel10k
    if [[ ! -d "$themes_dir/powerlevel10k" ]]; then
        gum style --foreground "$THEME_SECONDARY" "Cloning Powerlevel10k..."
        if ! git clone --depth=1 https://github.com/romkatv/powerlevel10k.git "$themes_dir/powerlevel10k"; then
             gum style --foreground "$THEME_ERROR" "Failed to clone Powerlevel10k"
             return 1
        fi
    fi

    # 4. Aliases file
    if [[ ! -f "$zsh_custom/aliases.zsh" ]]; then
        if ! touch "$zsh_custom/aliases.zsh"; then
             gum style --foreground "$THEME_ERROR" "Failed to create aliases.zsh"
             return 1
        fi
    fi

    return 0
}