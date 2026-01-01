#!/usr/bin/env bash

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║  LOGGING & UI PRIMITIVES                                                   ║
# ║  Terminal Neo-Noir Design System - Low-level Components                    ║
# ╠════════════════════════════════════════════════════════════════════════════╣
# ║  PRIMITIVES:                                                               ║
# ║    log_title      - Animated logo splash with boot sequence                ║
# ║    log_section    - Major section header with double border                ║
# ║    log_phase      - Light phase separator                                  ║
# ║    log_progress   - Package progress counter [01/12] ◆ name                ║
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

    local boot_msgs=(
        "  ▸ system.init(verbose=true)"
        "  ▸ modules.load(all)"
        "  ▸ config.parse()"
        "  ▸ env.detect()"
    )

    for msg in "${boot_msgs[@]}"; do
        gum style --foreground "$THEME_SUBTEXT" --faint "$msg"
        sleep 0.02
    done

    gum style --foreground "$THEME_ACCENT" "  ▸ system.ready"
    sleep 0.1

    printf "\033[6A"
    for i in {1..6}; do
        printf "\033[2K\n"
    done
    printf "\033[6A"

    echo ""

    local logo=(
        "   ▄███████╗████████╗███████╗███████╗███████╗   "
        "   ██╔════╝   ██╔══╝ ██╔════╝██╔════╝   ███╔╝   "
        "   ███████╗   ██║    █████╗  █████╗   ███╔╝     "
        "   ╚════██║   ██║    ██╔══╝  ██╔══╝  ███╔╝      "
        "   ███████║   ██║    ███████╗███████╗███████╗   "
        "   ╚══════╝   ╚═╝    ╚══════╝╚══════╝╚══════╝   "
    )

    for line in "${logo[@]}"; do
        gum style --foreground "$THEME_PRIMARY" --bold "  $line"
        sleep 0.02
    done

    echo ""

    if [[ -n "$subtitle" ]]; then
        local styled_sub
        styled_sub=$(echo "$subtitle" | tr '[:lower:]' '[:upper:]')
        gum style \
            --foreground "$THEME_SECONDARY" \
            --bold \
            --align center \
            --width 52 \
            "── $styled_sub ──"
    fi

    if [[ -n "$info" ]]; then
        sleep 0.1
        gum style \
            --foreground "$THEME_SUBTEXT" \
            --faint \
            --align center \
            --width 52 \
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
    local label=" $upper_text "
    local label_len=${#label}
    local total_width=48
    local line_len=$((total_width - label_len - 2))
    
    local line=""
    for ((i=0; i<line_len; i++)); do line+="─"; done
    
    gum style --foreground "$THEME_PRIMARY" --bold "  ╭─$label$line"
    gum style --foreground "$THEME_PRIMARY" "  │"
}

# Phase separator (lighter than section)
log_phase() {
    local text="$1"
    echo ""
    gum style --foreground "$THEME_SUBTEXT" --faint "  ── $text ──"
}

# Helper: Status item with clean alignment
# Format: "    [icon] Label .................. STATUS"
_log_item() {
    local icon="$1"
    local color="$2"
    local item="$3"
    local details="$4"

    local total_width=44
    local status_upper
    status_upper=$(echo "$details" | tr '[:lower:]' '[:upper:]')

    local content_len=$((${#item} + ${#status_upper}))
    local dots_len=$((total_width - content_len))
    if [[ $dots_len -lt 3 ]]; then dots_len=3; fi

    local dots
    dots=$(printf '%*s' "$dots_len" '' | sed 's/ /·/g')

    printf "    %s %s %s %s\n" \
        "$(gum style --foreground "$color" "$icon")" \
        "$(gum style --foreground "$THEME_TEXT" "$item")" \
        "$(gum style --foreground "$THEME_SUBTEXT" --faint "$dots")" \
        "$(gum style --foreground "$color" --bold "$status_upper")"
}

# 3. Success Item
log_success() {
    _log_item "✔" "$THEME_SUCCESS" "$1" "$2"
}

# 4. Failure Item
log_failure() {
    _log_item "✘" "$THEME_ERROR" "$1" "$2"
}

# 5. Info/Skip Item
log_info() {
    _log_item "•" "$THEME_SUBTEXT" "$1" "$2"
}

# 6. Subsection (Indented, dimmed label)
log_subsection() {
    local label="$1"
    echo "    $(gum style --foreground "$THEME_SUBTEXT" "$label")"
}

# 7. Warning Item
log_warn() {
    _log_item "⚠" "$THEME_WARNING" "$1" "$2"
}

# 8. Progress Header (Package X/Total) - clean counter format
log_progress() {
    local current="$1"
    local total="$2"
    local name="$3"

    local counter
    counter=$(printf "[%02d/%02d]" "$current" "$total")

    echo ""
    printf "  %s %s\n" \
        "$(gum style --foreground "$THEME_SUBTEXT" "$counter")" \
        "$(gum style --foreground "$THEME_PRIMARY" --bold "◆ $name")"
}

# ═══════════════════════════════════════════════════════════════════════════════
# POST-INSTALLATION TREE RENDERER
# ═══════════════════════════════════════════════════════════════════════════════

# Global status arrays - set by setup functions
declare -a POST_ZSH_ITEMS=()
declare -a POST_GIT_ITEMS=()
declare -a POST_FONTS_ITEMS=()
declare -a POST_OPENCODE_ITEMS=()
declare -a POST_THEME_ITEMS=()

# Add item to post-install status
# Usage: post_add "ZSH" "Oh-My-Zsh" "Installed"
post_add() {
    local category="$1"
    local label="$2"
    local status="$3"
    
    case "$category" in
        ZSH)      POST_ZSH_ITEMS+=("$label|$status") ;;
        GIT)      POST_GIT_ITEMS+=("$label|$status") ;;
        FONTS)    POST_FONTS_ITEMS+=("$label|$status") ;;
        OPENCODE) POST_OPENCODE_ITEMS+=("$label|$status") ;;
        THEME)    POST_THEME_ITEMS+=("$label|$status") ;;
    esac
}

# Render a single tree category
_render_tree_category() {
    local title="$1"
    local success="$2"
    shift 2
    local -a items=("$@")
    
    local icon="✔"
    local title_color="$THEME_SUCCESS"
    [[ "$success" != "true" ]] && icon="✘" && title_color="$THEME_ERROR"
    
    printf "  %s %s\n" \
        "$(gum style --foreground "$title_color" "$icon")" \
        "$(gum style --foreground "$THEME_TEXT" --bold "$title")"
    
    local count=${#items[@]}
    local i=0
    for item in "${items[@]}"; do
        ((i++))
        local label="${item%%|*}"
        local status="${item##*|}"
        
        local branch="├──"
        [[ $i -eq $count ]] && branch="└──"
        
        local dots=""
        local dot_count=$((28 - ${#label}))
        for ((d=0; d<dot_count; d++)); do dots+="."; done
        
        printf "     %s %s %s %s\n" \
            "$(gum style --foreground "$THEME_SUBTEXT" "$branch")" \
            "$(gum style --foreground "$THEME_TEXT" "$label")" \
            "$(gum style --foreground "$THEME_SUBTEXT" "$dots")" \
            "$(gum style --foreground "$THEME_SUBTEXT" "$status")"
    done
}

# Render complete post-installation summary
render_post_install_summary() {
    local zsh_ok="${1:-true}"
    local git_ok="${2:-true}"
    local fonts_ok="${3:-true}"
    
    echo ""
    
    local width=64
    local border_line=""
    for ((i=0; i<width-2; i++)); do border_line+="─"; done
    
    gum style --foreground "$THEME_PRIMARY" "  ╭─ POST-INSTALLATION $border_line"
    gum style --foreground "$THEME_PRIMARY" "  │"
    
    # Render each category that has items
    if [[ ${#POST_ZSH_ITEMS[@]} -gt 0 ]]; then
        _render_tree_category "Zsh Environment" "$zsh_ok" "${POST_ZSH_ITEMS[@]}"
        gum style --foreground "$THEME_PRIMARY" "  │"
    fi
    
    if [[ ${#POST_GIT_ITEMS[@]} -gt 0 ]]; then
        _render_tree_category "Git Configuration" "$git_ok" "${POST_GIT_ITEMS[@]}"
        gum style --foreground "$THEME_PRIMARY" "  │"
    fi
    
    if [[ ${#POST_FONTS_ITEMS[@]} -gt 0 ]]; then
        _render_tree_category "Fonts" "$fonts_ok" "${POST_FONTS_ITEMS[@]}"
        gum style --foreground "$THEME_PRIMARY" "  │"
    fi
    
    if [[ ${#POST_OPENCODE_ITEMS[@]} -gt 0 ]]; then
        _render_tree_category "OpenCode" "true" "${POST_OPENCODE_ITEMS[@]}"
        gum style --foreground "$THEME_PRIMARY" "  │"
    fi
    
    if [[ ${#POST_THEME_ITEMS[@]} -gt 0 ]]; then
        _render_tree_category "Theme" "true" "${POST_THEME_ITEMS[@]}"
        gum style --foreground "$THEME_PRIMARY" "  │"
    fi
    
    gum style --foreground "$THEME_PRIMARY" "  ╰$border_line──╯"
}