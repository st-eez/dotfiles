#!/usr/bin/env bash

# Logging & UI Primitives
# Wraps Gum for a consistent, high-polish look.

# Source theme if not already sourced
if [[ -z "$THEME_PRIMARY" ]]; then
    # shellcheck disable=SC1091
    source "$(dirname "${BASH_SOURCE[0]}")/theme.sh"
fi

# 1. Title with Unicode Block Art
log_title() {
    local subtitle="$1"
    local info="$2"
    
    echo ""
    # "STEEZ" in Block Unicode
    # Solid Primary Color
    gum style --foreground "$THEME_PRIMARY"   "███████╗████████╗███████╗███████╗███████╗"
    gum style --foreground "$THEME_PRIMARY"   "██╔════╝╚══██╔══╝██╔════╝██╔════╝╚══███╔╝"
    gum style --foreground "$THEME_PRIMARY"   "███████╗   ██║   █████╗  █████╗    ███╔╝ "
    gum style --foreground "$THEME_PRIMARY"   "╚════██║   ██║   ██╔══╝  ██╔══╝   ███╔╝  "
    gum style --foreground "$THEME_PRIMARY"   "███████║   ██║   ███████╗███████╗███████╗"
    gum style --foreground "$THEME_PRIMARY"   "╚══════╝   ╚═╝   ╚══════╝╚══════╝╚══════╝"
    
    echo ""
    
    # Subtitle (Centered, uppercase, spaced)
    if [[ -n "$subtitle" ]]; then
        gum style \
            --foreground "$THEME_TEXT" \
            --bold \
            --align center \
            --width 43 \
            "$(echo "$subtitle" | tr '[:lower:]' '[:upper:]')"
    fi
    
    # Extra Info (Dimmed)
    if [[ -n "$info" ]]; then
        gum style \
            --foreground "$THEME_SUBTEXT" \
            --align center \
            --width 43 \
            "$info"
    fi
}

# 2. Section Header (Clean, no bullet, just bold text)
log_section() {
    local text="$1"
    echo ""
    gum style --foreground "$THEME_PRIMARY" --bold --underline "$text"
}

# Helper: Item with Dot Leaders
# "Name ............ STATUS"
_log_item() {
    local icon="$1"
    local color="$2"
    local item="$3"
    local details="$4"
    
    # Fixed widths
    local name_width=25
    
    # 1. Name Column
    local p_name=$(gum style --foreground "$THEME_TEXT" --width $name_width --padding "0 1 0 0" "$item")
    
    # 2. Status Column (Bold, Uppercase)
    local p_stat=$(gum style --foreground "$color" --bold "$(echo "$details" | tr '[:lower:]' '[:upper:]')")
    
    # 3. Dots (Calculated in bash because gum doesn't do leaders)
    # We essentially rely on the visual separation. 
    # Let's try a strict alignment approach using `gum join` and a fixed width filler.
    
    # Alternative: Use printf to generate the dots, then style them.
    # Total width target: 60
    local content_len=$((${#item} + ${#details} + 2)) # +2 for spaces
    local dots_len=$((50 - content_len))
    if [[ $dots_len -lt 2 ]]; then dots_len=2; fi
    
    local dots
    dots=$(printf "%*s" "$dots_len" "" | tr ' ' '.')
    
    local p_dots=$(gum style --foreground "$THEME_SUBTEXT" --faint "$dots")
    
    # Icon + Name + Dots + Status
    echo " $(gum style --foreground "$color" "$icon") $item $p_dots $(gum style --foreground "$color" --bold "$details")"
}

# 3. Success Item
log_success() {
    # Icon: Check mark
    # Color: Green
    _log_item "✔" "$THEME_SUCCESS" "$1" "$2"
}

# 4. Failure Item
log_failure() {
    # Icon: Cross
    # Color: Red
    _log_item "✘" "$THEME_ERROR" "$1" "$2"
}

# 5. Info/Skip Item
log_info() {
    # Icon: Dot
    # Color: Dimmed
    _log_item "•" "$THEME_SUBTEXT" "$1" "$2"
}