#!/usr/bin/env bash

# Git Configuration Setup
# Configures git credential helper and sets sensible defaults

setup_git_config() {
    gum style --foreground "$THEME_PRIMARY" "  ◆ Setting up Git configuration..."

    local changes_made=false

    # 1. Check if gh is installed
    if ! command -v gh >/dev/null 2>&1; then
        gum style --foreground "$THEME_WARNING" "  'gh' not found - skipping credential setup"
        return 0
    fi

    # 2. Check if gh is authenticated (optional - credential helper is a convenience)
    if ! gh auth status >/dev/null 2>&1; then
        gum style --foreground "$THEME_WARNING" "  'gh' not authenticated (optional)"
        gum style --foreground "$THEME_SUBTEXT" "    Run 'gh auth login' to enable git credential helper"
        return 0
    fi

    # 3. Use GitHub's official command to configure git credential helper
    gh auth setup-git

    # 4. Set default branch if not already configured
    if ! git config --global init.defaultBranch >/dev/null 2>&1; then
        git config --global init.defaultBranch main
        changes_made=true
    fi

    # 5. Warn if user info missing
    if ! git config --global user.name >/dev/null 2>&1; then
        gum style --foreground "$THEME_WARNING" "  Missing: git config --global user.name 'Your Name'"
    fi
    if ! git config --global user.email >/dev/null 2>&1; then
        gum style --foreground "$THEME_WARNING" "  Missing: git config --global user.email 'you@example.com'"
    fi

    # Summary
    if [[ "$changes_made" == true ]]; then
        gum style --foreground "$THEME_SUCCESS" "  Configured"
    else
        gum style --foreground "$THEME_SUBTEXT" "  Already configured"
    fi
}