#!/usr/bin/env bash

# UI Components using Charm Gum
# Depends on: lib/theme.sh, lib/logging.sh

# Ensure logging is available
if ! declare -F log_title > /dev/null; then
    source "$(dirname "${BASH_SOURCE[0]}")/logging.sh"
fi

# Splash screen with ASCII art and system info
ui_splash() {
    local version="${1:-2.0.0}"

    # System metadata
    local os_info=""
    case "$OS" in
        macos)
            if command -v sw_vers >/dev/null; then
                os_info="macOS $(sw_vers -productVersion 2>/dev/null || echo '')"
            else
                os_info="macOS"
            fi
            ;; 
        linux)
            if [[ -f /etc/os-release ]]; then
                os_info=$(grep PRETTY_NAME /etc/os-release | cut -d'"' -f2)
            else
                os_info="Linux"
            fi
            ;; 
        *)
            os_info="${OS:-Unknown OS}"
            ;; 
    esac

    local shell_info="${SHELL##*/}"
    local term_info="${TERM:-unknown}"
    local metadata="$os_info  •  $shell_info  •  $term_info"

    # Delegate to the standardized title logger
    log_title "Dotfiles Installer v$version" "$metadata"
}

# Display a styled header (Alias to log_section or log_title depending on use)
# kept for compatibility but updated style
ui_header() {
    log_section "$1"
}

# Display a confirmation dialog
# Usage: ui_confirm "Question?" "yes_label" "no_label"
# Returns: 0 for Yes, 1 for No
ui_confirm() {
    local prompt="$1"
    local yes_label="${2:-Yes}"
    local no_label="${3:-No}"

    gum confirm "$prompt" \
        --affirmative "$yes_label" \
        --negative "$no_label" \
        --prompt.foreground "$THEME_ACCENT" \
        --selected.background "$THEME_PRIMARY" \
        --selected.foreground "$COLOR_BG" \
        --unselected.foreground "$THEME_SUBTEXT"
}

# Select packages to install
# Usage: ui_select_packages
# Returns: Space-separated list of selected packages in $SELECTED_PACKAGES
ui_select_packages() {
    local items=()

    # 1. Add macOS packages (only if on macOS)
    if [[ "$OS" == "macos" ]]; then
        for pkg in "${MACOS_PKGS[@]}"; do
            items+=("macOS:$pkg")
        done
    fi

    # 2. Add Terminal packages (Cross-platform)
    for pkg in "${TERMINAL_PKGS[@]}"; do
        items+=("Terminal:$pkg")
    done

    # 3. Use gum choose for selection
    local selection
    selection=$(printf "%s\n" "${items[@]}" | gum choose --no-limit --height 20 --header "Select packages (Space to select, Enter to confirm)" --cursor.foreground "$THEME_PRIMARY" --item.foreground "$THEME_TEXT" --selected.foreground "$THEME_SUCCESS")

    if [[ -z "$selection" ]]; then
        return 1
    fi

    # Clean up selection (remove "Category:" prefix)
    SELECTED_PACKAGES=""
    while IFS= read -r line; do
        clean_pkg="${line#*:}"
        SELECTED_PACKAGES+="$clean_pkg "
    done <<< "$selection"
    
    # Trim trailing space
    SELECTED_PACKAGES="${SELECTED_PACKAGES% }"
    
    return 0
}