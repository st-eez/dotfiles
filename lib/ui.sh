#!/usr/bin/env bash

# UI Components using Charm Gum
# Depends on: lib/theme.sh

# Display a styled header
ui_header() {
    local title="$1"
    local subtitle="${2:-}"

    gum style \
        --foreground "$THEME_PRIMARY" \
        --border-foreground "$THEME_SECONDARY" \
        --border double \
        --align center \
        --width 50 \
        --margin "1 2" \
        --padding "1 2" \
        "$title" "$subtitle"
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
    # We strip the "Category:" prefix for the result, but keep it for display if gum supported groups better.
    # Since gum choose is simple, we'll just list them.
    # To make it nicer, we pass the raw strings.
    
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
