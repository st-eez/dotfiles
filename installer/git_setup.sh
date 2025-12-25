#!/usr/bin/env bash

# Git Configuration Setup
# Generates ~/.gitconfig from template with dynamic paths

setup_git_config() {
    gum style --foreground "$THEME_PRIMARY" "  ◆ Setting up Git configuration..."

    local template_path="$DOTFILES_DIR/git/.gitconfig.template"
    local config_path="$HOME/.gitconfig"
    local gh_path
    
    # 1. Detect 'gh' path
    if ! gh_path=$(command -v gh); then
        gum style --foreground "$THEME_WARNING" "  'gh' CLI not found. Defaulting to 'gh' in PATH."
        gh_path="gh"
    fi

    # 2. Read and Replace
    if [[ -f "$template_path" ]]; then
        local content
        content=$(<"$template_path")
        
        # Replace {{GH_PATH}}
        content="${content//\{\{GH_PATH\}\}/$gh_path}"
        
        # Replace {{HOME_DIR}}
        content="${content//\{\{HOME_DIR\}\}/$HOME}"

        # 3. Write to ~/.gitconfig
        # Check if existing file is a symlink (stow) or regular file
        if [[ -L "$config_path" ]]; then
            gum style --foreground "$THEME_SUBTEXT" "  Removing existing symlink ~/.gitconfig..."
            rm "$config_path"
        elif [[ -f "$config_path" ]]; then
             local backup="$config_path.bak.$(date +%Y%m%d_%H%M%S)"
             mv "$config_path" "$backup"
             gum style --foreground "$THEME_SUBTEXT" "  Backed up existing .gitconfig to $backup"
        fi

        echo "$content" > "$config_path"
        gum style --foreground "$THEME_SUCCESS" "  Generated ~/.gitconfig (gh: $gh_path)"
    else
        gum style --foreground "$THEME_ERROR" "  Template not found: $template_path"
        return 1
    fi
}
