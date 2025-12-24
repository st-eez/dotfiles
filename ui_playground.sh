#!/usr/bin/env bash

# UI Playground
# Verifies the look and feel of lib/logging.sh

source "lib/logging.sh"

clear

log_title "UI Playground" "Verifying Alignment & Theme"

log_section "Core Statuses"
log_success "Neovim" "Installed v0.9.0"
log_success "Tmux" "Installed v3.3"
log_failure "Docker" "Not found in PATH"
log_info "Zsh" "Skipped (Already installed)"

log_section "Alignment Check (Long Names)"
log_success "SomeLongPackageName" "Installed"
log_failure "AnotherLongPkg" "Failed to download"
log_info "Short" "Ignored"

log_section "Error Details"
log_failure "CriticalError" "Disk full (error code 127)"
log_failure "UnknownError" # No details provided

echo ""
