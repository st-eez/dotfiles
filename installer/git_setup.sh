#!/usr/bin/env bash

# Git Configuration Setup
# Configures git credential helper and sets sensible defaults

setup_git_config() {
    if ! command -v gh >/dev/null 2>&1; then
        post_add "GIT" "Credential Helper" "Skipped (gh missing)"
        return 0
    fi

    if ! gh auth status >/dev/null 2>&1; then
        post_add "GIT" "Credential Helper" "Skipped (not logged in)"
        return 0
    fi

    gh auth setup-git 2>/dev/null

    if ! git config --global init.defaultBranch >/dev/null 2>&1; then
        git config --global init.defaultBranch main
        post_add "GIT" "Default Branch" "Set to main"
    fi

    post_add "GIT" "Credential Helper" "OK"
}