#!/usr/bin/env bash

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║  LOGGING & UI PRIMITIVES                                                   ║
# ║  Terminal Neo-Noir Design System - Low-level Components                    ║
# ╠════════════════════════════════════════════════════════════════════════════╣
# ║  PRIMITIVES:                                                               ║
# ║    log_title      - Animated logo splash with boot sequence                ║
# ║    log_section    - Major section header with double border                ║
# ║    log_phase      - Light phase separator                                  ║
# ║    log_progress   - Package progress with gradient bar                     ║
# ║    log_success    - Success status item (✔ green)                          ║
# ║    log_failure    - Failure status item (✘ red)                            ║
# ║    log_info       - Info status item (• dimmed)                            ║
# ║    log_warn       - Warning status item (⚠ yellow)                         ║
# ║    log_rule       - Horizontal rule with optional label                    ║
# ║                                                                            ║
# ║  EFFECTS:                                                                  ║
# ║    _boot_line     - Boot sequence line                                     ║
# ║    _type_effect   - Character-by-character typing                          ║
# ║    _glitch_line   - Cyberpunk glitch effect                                ║
# ║                                                                            ║
# ║  Depends on: lib/theme.sh (Tokyo Night palette)                            ║
# ╚════════════════════════════════════════════════════════════════════════════╝

# Source theme if not already sourced
if [[ -z "$THEME_PRIMARY" ]]; then
    # shellcheck disable=SC1091
    source "$(dirname "${BASH_SOURCE[0]}")/theme.sh"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# DECORATIVE ELEMENTS
# ═══════════════════════════════════════════════════════════════════════════════

# Unicode box drawing characters for consistent styling
readonly BOX_H="─"
readonly BOX_V="│"
readonly BOX_TL="╭"
readonly BOX_TR="╮"
readonly BOX_BL="╰"
readonly BOX_BR="╯"
readonly BOX_FADE="░"
readonly ARROW="›"
readonly BULLET="◆"
readonly CHECK="✓"
readonly CROSS="✗"
readonly DOT="●"

# Draw a horizontal rule with optional label
log_rule() {
    local label="${1:-}"
    local width="${2:-60}"
    local color="${3:-$THEME_SUBTEXT}"

    if [[ -n "$label" ]]; then
        local label_len=${#label}
        local side_len=$(( (width - label_len - 4) / 2 ))
        local left_line=$(printf '%*s' "$side_len" '' | tr ' ' "$BOX_H")
        local right_line=$(printf '%*s' "$side_len" '' | tr ' ' "$BOX_H")
        gum style --foreground "$color" "$left_line $BOX_FADE $label $BOX_FADE$right_line"
    else
        local line=$(printf '%*s' "$width" '' | tr ' ' "$BOX_H")
        gum style --foreground "$color" --faint "$line"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# TITLE & SPLASH
# ═══════════════════════════════════════════════════════════════════════════════

# Animated boot sequence effect
_boot_line() {
    local text="$1"
    local delay="${2:-0.02}"
    gum style --foreground "$THEME_SUBTEXT" --faint "$text"
    sleep "$delay"
}

# Typing effect for dramatic text reveals
_type_effect() {
    local text="$1"
    local color="${2:-$THEME_SUBTEXT}"
    local delay="${3:-0.015}"
    local prefix="${4:-}"

    printf "%s" "$prefix"
    for ((i=0; i<${#text}; i++)); do
        gum style --foreground "$color" "${text:$i:1}" | tr -d '\n'
        sleep "$delay"
    done
    echo ""
}

# Glitch effect for cyberpunk aesthetic
_glitch_line() {
    local text="$1"
    local color="${2:-$THEME_PRIMARY}"
    local glitch_chars="░▒▓█▀▄"

    # Brief glitch
    local glitched=""
    for ((i=0; i<${#text}; i++)); do
        if [[ $((RANDOM % 5)) -eq 0 ]] && [[ "${text:$i:1}" != " " ]]; then
            glitched+="${glitch_chars:$((RANDOM % ${#glitch_chars})):1}"
        else
            glitched+="${text:$i:1}"
        fi
    done
    gum style --foreground "$THEME_SUBTEXT" --faint "$glitched"
    sleep 0.03
    printf "\033[1A\033[2K"  # Move up and clear line
    gum style --foreground "$color" "$text"
}

# 1. Title with Unicode logo and scan-line animation
log_title() {
    local subtitle="$1"
    local info="$2"

    clear
    echo ""

    # Enhanced boot sequence with progressive reveal
    gum style --foreground "$THEME_SUBTEXT" --faint "  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░"
    sleep 0.05

    # Boot messages with varying delays for rhythm
    local boot_msgs=(
        "  ▸ initializing steez..."
        "  ▸ loading modules..."
        "  ▸ parsing configuration..."
        "  ▸ detecting environment..."
    )

    for msg in "${boot_msgs[@]}"; do
        gum style --foreground "$THEME_SUBTEXT" --faint "$msg"
        sleep 0.04
    done

    gum style --foreground "$THEME_ACCENT" --faint "  ▸ ready"
    sleep 0.1

    # Clear boot sequence for clean reveal
    printf "\033[7A"  # Move up 7 lines
    for i in {1..7}; do
        printf "\033[2K\n"  # Clear each line
    done
    printf "\033[7A"  # Move back up

    echo ""

    # Unicode STEEZ logo - scan-line reveal with glow effect (48 internal width)
    local logo=(
        "  ╭────────────────────────────────────────────────╮"
        "  │                                                │"
        "  │   ▄███████╗████████╗███████╗███████╗███████╗   │"
        "  │   ██╔════╝   ██╔══╝ ██╔════╝██╔════╝   ███╔╝   │"
        "  │   ███████╗   ██║    █████╗  █████╗   ███╔╝     │"
        "  │   ╚════██║   ██║    ██╔══╝  ██╔══╝  ███╔╝      │"
        "  │   ███████║   ██║    ███████╗███████╗███████╗   │"
        "  │   ╚══════╝   ╚═╝    ╚══════╝╚══════╝╚══════╝   │"
        "  │                                                │"
        "  │               ─── DOTFILES ───                 │"
        "  │                                                │"
        "  ╰────────────────────────────────────────────────╯"
    )

    # Animated reveal with acceleration (starts slow, speeds up)
    local delay=0.05
    for i in "${!logo[@]}"; do
        gum style --foreground "$THEME_PRIMARY" "${logo[$i]}"
        sleep "$delay"
        # Accelerate after first few lines
        if [[ $i -gt 2 ]]; then
            delay=0.015
        fi
    done

    echo ""

    # Subtitle with decorative accents
    if [[ -n "$subtitle" ]]; then
        local styled_sub
        styled_sub=$(echo "$subtitle" | tr '[:lower:]' '[:upper:]')
        gum style \
            --foreground "$THEME_SECONDARY" \
            --bold \
            --align center \
            --width 51 \
            "◆ $styled_sub ◆"
    fi

    # Extra Info (Dimmed)
    if [[ -n "$info" ]]; then
        sleep 0.1
        gum style \
            --foreground "$THEME_SUBTEXT" \
            --faint \
            --align center \
            --width 51 \
            "$info"
    fi

    echo ""
}

# 2. Section Header with decorative border
log_section() {
    local text="$1"
    local upper_text
    upper_text=$(echo "$text" | tr '[:lower:]' '[:upper:]')

    echo ""
    gum style --foreground "$THEME_PRIMARY" "  ═══════════════════════════════════════════════"
    gum style --foreground "$THEME_PRIMARY" --bold "    $upper_text"
    gum style --foreground "$THEME_PRIMARY" "  ───────────────────────────────────────────────"
}

# Phase separator (lighter than section)
log_phase() {
    local text="$1"
    echo ""
    gum style --foreground "$THEME_SUBTEXT" --faint "  ─── $text ───"
}

# Helper: Status item with clean alignment
# Format: "    [icon] Label .................. STATUS"
_log_item() {
    local icon="$1"
    local color="$2"
    local item="$3"
    local details="$4"

    # Fixed total width for alignment
    local total_width=44
    local status_upper
    status_upper=$(echo "$details" | tr '[:lower:]' '[:upper:]')

    # Calculate dot leader length
    local content_len=$((${#item} + ${#status_upper}))
    local dots_len=$((total_width - content_len))
    if [[ $dots_len -lt 3 ]]; then dots_len=3; fi

    # Build dot leader with fade effect (solid → dim)
    # Note: Use sed instead of tr for UTF-8 compatibility on Linux
    local dots
    dots=$(printf '%*s' "$dots_len" '' | sed 's/ /·/g')

    # Compose the line with proper spacing
    printf "    %s %s %s %s\n" \
        "$(gum style --foreground "$color" "$icon")" \
        "$(gum style --foreground "$THEME_TEXT" "$item")" \
        "$(gum style --foreground "$THEME_SUBTEXT" --faint "$dots")" \
        "$(gum style --foreground "$color" --bold "$status_upper")"
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

# 6. Subsection (Indented, dimmed label)
log_subsection() {
    local label="$1"
    echo "    $(gum style --foreground "$THEME_SUBTEXT" "$label")"
}

# 7. Warning Item
log_warn() {
    # Icon: Warning triangle
    # Color: Yellow
    _log_item "⚠" "$THEME_WARNING" "$1" "$2"
}

# 8. Progress Header (Package X/Total) with gradient progress bar
log_progress() {
    local current="$1"
    local total="$2"
    local name="$3"

    # Calculate progress bar with gradient effect
    local bar_width=24
    local filled=$((current * bar_width / total))
    local empty=$((bar_width - filled))

    # Build gradient bar: solid → medium → light → empty
    local bar=""
    for ((i=0; i<filled; i++)); do
        if [[ $i -eq $((filled - 1)) ]] && [[ $filled -lt $bar_width ]]; then
            bar+="▓"  # Trailing edge is medium
        else
            bar+="█"  # Filled portion is solid
        fi
    done

    # Add empty portion with subtle texture
    for ((i=0; i<empty; i++)); do
        bar+="░"
    done

    # Calculate percentage
    local percent=$((current * 100 / total))

    echo ""
    # Package name header with bullet
    gum style --foreground "$THEME_PRIMARY" --bold "  ◆ $name"

    # Progress bar with percentage
    local counter_str="[$current/$total]"
    printf "    %s %s %3d%%\n" \
        "$(gum style --foreground "$THEME_SECONDARY" "$bar")" \
        "$(gum style --foreground "$THEME_SUBTEXT" --faint "$counter_str")" \
        "$percent"
}