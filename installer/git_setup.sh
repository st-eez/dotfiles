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
        if ! content=$(<"$template_path"); then
             gum style --foreground "$THEME_ERROR" "Failed to read template: $template_path"
             return 1
        fi
        
        # Replace {{GH_PATH}}
        content="${content//\{\{GH_PATH\}\}/$gh_path}"
        
        # Replace {{HOME_DIR}}
        content="${content//\{\{HOME_DIR\}\}/$HOME}"

        # 3. Write to ~/.gitconfig
        # Check if existing file is a symlink (stow) or regular file
        if [[ -L "$config_path" ]]; then
            gum style --foreground "$THEME_SUBTEXT" "  Removing existing symlink ~/.gitconfig..."
            if ! rm "$config_path"; then
                gum style --foreground "$THEME_ERROR" "Failed to remove existing symlink"
                return 1
            fi
        elif [[ -f "$config_path" ]]; then
             local backup="$config_path.bak.$(date +%Y%m%d_%H%M%S)"
             if ! mv "$config_path" "$backup"; then
                 gum style --foreground "$THEME_ERROR" "Failed to backup existing .gitconfig"
                 return 1
             fi
             gum style --foreground "$THEME_SUBTEXT" "  Backed up existing .gitconfig to $backup"
        fi

        if echo "$content" > "$config_path"; then
            gum style --foreground "$THEME_SUCCESS" "  Generated ~/.gitconfig (gh: $gh_path)"
        else
            gum style --foreground "$THEME_ERROR" "Failed to write to $config_path"
            return 1
        fi
    else
        gum style --foreground "$THEME_ERROR" "  Template not found: $template_path"
        return 1
    fi
}