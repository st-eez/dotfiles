#!/usr/bin/env bash

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║  UI COMPONENT LIBRARY                                                      ║
# ║  Terminal Neo-Noir Design System using Charm Gum                           ║
# ╠════════════════════════════════════════════════════════════════════════════╣
# ║  COMPONENTS:                                                               ║
# ║    ui_splash      - Animated splash screen with system info                ║
# ║    ui_main_menu   - Installation mode selector                             ║
# ║    ui_select_packages - Multi-select package chooser                       ║
# ║    ui_preflight   - Pre-installation summary panel                         ║
# ║    ui_summary     - Animated completion summary with stats                 ║
# ║    ui_confirm     - Styled yes/no confirmation dialog                      ║
# ║    ui_spin        - Spinner wrapper for long operations                    ║
# ║    ui_progress_bar - Visual progress indicator                             ║
# ║    ui_exit        - Styled goodbye message                                 ║
# ║    ui_cancelled   - Cancellation warning                                   ║
# ║    ui_error       - Error message display                                  ║
# ║                                                                            ║
# ║  DESIGN TOKENS:                                                            ║
# ║    Box width: 48 chars internal | Corners: Rounded (╭╮╰╯)                  ║
# ║    Animation: 0.02-0.1s delays  | Leaders: Middle-dot (·)                  ║
# ║                                                                            ║
# ║  Depends on: lib/theme.sh, lib/logging.sh                                  ║
# ╚════════════════════════════════════════════════════════════════════════════╝

# Ensure logging is available
if ! declare -F log_title > /dev/null; then
    source "$(dirname "${BASH_SOURCE[0]}")/logging.sh"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# SPLASH & SYSTEM INFO
# ═══════════════════════════════════════════════════════════════════════════════

# Gather system diagnostics
_get_system_info() {
    local os_info=""
    local arch_info=""

    case "$OS" in
        macos)
            if command -v sw_vers >/dev/null; then
                os_info="macOS $(sw_vers -productVersion 2>/dev/null || echo '')"
            else
                os_info="macOS"
            fi
            arch_info=$(uname -m)
            ;;
        linux)
            if [[ -f /etc/os-release ]]; then
                os_info=$(grep PRETTY_NAME /etc/os-release | cut -d'"' -f2)
            else
                os_info="Linux"
            fi
            arch_info=$(uname -m)
            ;;
        *)
            os_info="${OS:-Unknown}"
            arch_info="unknown"
            ;;
    esac

    echo "$os_info|$arch_info|${SHELL##*/}|${TERM:-unknown}"
}

# Splash screen with animated boot sequence
ui_splash() {
    local version="${1:-2.0.0}"

    # Get system info
    local sys_info
    sys_info=$(_get_system_info)
    IFS='|' read -r os_info arch_info shell_info term_info <<< "$sys_info"

    # Build metadata string
    local metadata="$os_info ($arch_info)  $BULLET  $shell_info  $BULLET  $term_info"

    # Render title with animation
    log_title "Dotfiles Installer v$version" "$metadata"

    # System diagnostic panel with animated reveal (48 char internal width)
    local panel_lines=(
        "  ╭─ SYSTEM ───────────────────────────────────────╮"
        "$(printf "  │  %-8s %-37s│" "OS" "$os_info")"
        "$(printf "  │  %-8s %-37s│" "ARCH" "$arch_info")"
        "$(printf "  │  %-8s %-37s│" "SHELL" "$shell_info")"
        "$(printf "  │  %-8s %-37s│" "TERM" "$term_info")"
        "  ╰────────────────────────────────────────────────╯"
    )

    # Staggered reveal for panel
    for line in "${panel_lines[@]}"; do
        gum style --foreground "$THEME_SUBTEXT" "$line"
        sleep 0.02
    done
    echo ""
}

# Run a command with a spinner
# Usage: ui_spin "message" command [args...]
ui_spin() {
    local title="$1"
    shift
    gum spin \
        --spinner dot \
        --spinner.foreground "$THEME_PRIMARY" \
        --title.foreground "$THEME_TEXT" \
        --title " $title" \
        -- "$@"
}

# Animated progress bar (for known-length operations)
ui_progress_bar() {
    local current="$1"
    local total="$2"
    local width="${3:-30}"

    local percent=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))

    local bar=""
    for ((i=0; i<filled; i++)); do bar+="█"; done
    for ((i=0; i<empty; i++)); do bar+="░"; done

    printf "\r  %s %3d%%" "$(gum style --foreground "$THEME_PRIMARY" "$bar")" "$percent"
}

# Display a styled header (Alias to log_section or log_title depending on use)
ui_header() {
    log_section "$1"
}

# Display a styled confirmation dialog
ui_confirm() {
    local prompt="$1"
    local yes_label="${2:-Yes}"
    local no_label="${3:-No}"

    echo ""
    gum confirm "  $prompt" \
        --affirmative "  $yes_label  " \
        --negative "  $no_label  " \
        --prompt.foreground "$THEME_TEXT" \
        --prompt.bold \
        --selected.background "$THEME_PRIMARY" \
        --selected.foreground "$COLOR_BG" \
        --selected.bold \
        --unselected.foreground "$THEME_SUBTEXT"
}

# Styled exit/goodbye message
ui_exit() {
    local message="${1:-Goodbye}"
    echo ""
    gum style --foreground "$THEME_SUBTEXT" "  ─────────────────────────────────────────────────"
    gum style --foreground "$THEME_SUBTEXT" --faint "  $message"
    gum style --foreground "$THEME_SUBTEXT" "  ─────────────────────────────────────────────────"
    echo ""
}

# Styled cancellation message
ui_cancelled() {
    local reason="${1:-Operation cancelled}"
    echo ""
    gum style --foreground "$THEME_WARNING" "  ⚠ $reason"
    echo ""
}

# Styled error message
ui_error() {
    local message="$1"
    echo ""
    gum style --foreground "$THEME_ERROR" "  ✗ $message"
    echo ""
}

# Select packages to install
# Usage: ui_select_packages
# Returns: Space-separated list of selected packages in $SELECTED_PACKAGES
ui_select_packages() {
    local items=()
    local macos_count=0
    local terminal_count=0

    # 1. Prepare items with category markers
    if [[ "$OS" == "macos" ]]; then
        for pkg in "${MACOS_PKGS[@]}"; do
            items+=("$pkg")
            ((macos_count++))
        done
    fi

    for pkg in "${TERMINAL_PKGS[@]}"; do
        items+=("$pkg")
        ((terminal_count++))
    done

    local total_count=$((macos_count + terminal_count))

    # 2. Render Selection Menu with styled header (48 char internal width)
    echo ""
    gum style --foreground "$THEME_SUBTEXT" "  ╭─ PACKAGE SELECTION ────────────────────────────╮"
    gum style --foreground "$THEME_SUBTEXT" "  │                                                │"
    gum style --foreground "$THEME_SUBTEXT" "$(printf "  │  %-46s│" "$total_count packages available")"
    gum style --foreground "$THEME_SUBTEXT" "  │                                                │"
    gum style --foreground "$THEME_SUBTEXT" "$(printf "  │  %-46s│" "Space = toggle, Enter = confirm")"
    gum style --foreground "$THEME_SUBTEXT" "  │                                                │"
    gum style --foreground "$THEME_SUBTEXT" "  ╰────────────────────────────────────────────────╯"
    echo ""

    local selection
    selection=$(gum choose \
        --no-limit \
        --height 15 \
        --cursor "  ▸ " \
        --cursor.foreground "$THEME_PRIMARY" \
        --selected.foreground "$THEME_SUCCESS" \
        --unselected-prefix "  ○ " \
        --selected-prefix "  ◆ " \
        "${items[@]}")

    # Check for empty selection (user cancelled or selected nothing)
    if [[ -z "$selection" ]]; then
        return 1
    fi

    # 3. Parse Selection
    SELECTED_PACKAGES=""
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        SELECTED_PACKAGES+="$line "
    done <<< "$selection"

    # Trim trailing space
    SELECTED_PACKAGES="${SELECTED_PACKAGES% }"

    # Show selection count
    local selected_count
    selected_count=$(echo "$SELECTED_PACKAGES" | wc -w | tr -d ' ')
    echo ""
    gum style --foreground "$THEME_ACCENT" "  ◆ $selected_count packages selected"

    return 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN MENU & FLOW
# ═══════════════════════════════════════════════════════════════════════════════

# Main menu - returns "full", "custom", or "exit"
ui_main_menu() {
    # Section header with decorative border (48 char internal width)
    echo "" >&2
    gum style --foreground "$THEME_SUBTEXT" "  ╭─ INSTALLATION MODE ────────────────────────────╮" >&2
    gum style --foreground "$THEME_SUBTEXT" "  │                                                │" >&2
    gum style --foreground "$THEME_SUBTEXT" "  │  Use arrows to navigate, Enter to select       │" >&2
    gum style --foreground "$THEME_SUBTEXT" "  │                                                │" >&2
    gum style --foreground "$THEME_SUBTEXT" "  ╰────────────────────────────────────────────────╯" >&2
    echo "" >&2

    local choice
    choice=$(gum choose \
        --cursor "  ▸ " \
        --cursor.foreground "$THEME_PRIMARY" \
        --item.foreground "$THEME_SUBTEXT" \
        --selected.foreground "$THEME_TEXT" \
        --selected.bold \
        --height 5 \
        "◆ Full Setup (Recommended)" \
        "◇ Custom Selection" \
        "✕ Exit")

    case "$choice" in
        *"Full Setup"*) echo "full" ;;
        *"Custom"*) echo "custom" ;;
        *) echo "exit" ;;
    esac
}

# Pre-flight summary before installation
ui_preflight() {
    local count="$1"

    # Distro-aware package manager name
    local pkg_mgr="package manager"
    [[ "$DISTRO" == "macos" ]] && pkg_mgr="Homebrew"
    [[ "$DISTRO" == "arch" ]] && pkg_mgr="pacman"
    [[ "$DISTRO" == "debian" ]] && pkg_mgr="apt"

    echo ""
    gum style --foreground "$THEME_SUBTEXT" "  ╭─ PRE-FLIGHT ───────────────────────────────────╮"
    gum style --foreground "$THEME_SUBTEXT" "  │                                                │"
    gum style --foreground "$THEME_TEXT" "$(printf "  │  %-46s│" "> $count packages queued for installation")"
    gum style --foreground "$THEME_SUBTEXT" "  │                                                │"
    gum style --foreground "$THEME_SUBTEXT" "$(printf "  │  %-46s│" "This will:")"
    gum style --foreground "$THEME_SUBTEXT" "$(printf "  │    %-44s│" "- Install missing binaries via $pkg_mgr")"
    gum style --foreground "$THEME_SUBTEXT" "$(printf "  │    %-44s│" "- Symlink dotfiles via GNU Stow")"
    gum style --foreground "$THEME_SUBTEXT" "$(printf "  │    %-44s│" "- Backup existing configs if needed")"
    gum style --foreground "$THEME_SUBTEXT" "  │                                                │"
    gum style --foreground "$THEME_SUBTEXT" "  ╰────────────────────────────────────────────────╯"
    echo ""
}

# Installation summary with stats and completion animation
# Args: bin_new bin_exists cfg_new cfg_exists fail_count csv_file
ui_summary() {
    local bin_new="$1"
    local bin_exists="$2"
    local cfg_new="$3"
    local cfg_exists="$4"
    local failed="$5"
    local csv_file="$6"

    local total_new=$((bin_new + cfg_new))
    local total_exists=$((bin_exists + cfg_exists))

    echo ""
    echo ""

    # Determine overall status for theming
    local status_color="$THEME_SUCCESS"
    local status_text="SUCCESS"
    if [[ "$failed" -gt 0 ]]; then
        status_color="$THEME_WARNING"
        status_text="PARTIAL"
        if [[ "$total_new" -eq 0 ]] && [[ "$total_exists" -eq 0 ]]; then
            status_color="$THEME_ERROR"
            status_text="FAILED"
        fi
    fi

    # Box dimensions: 48 internal chars (matches other panels)
    local box_top="  ╭────────────────────────────────────────────────╮"
    local box_empty="  │                                                │"
    local box_bottom="  ╰────────────────────────────────────────────────╯"

    # Center the status text (use printf for reliable padding)
    local status_msg="INSTALLATION $status_text"
    local msg_display
    msg_display=$(printf "%s" "$status_msg")
    local pad_left=$(( (48 - ${#status_msg}) / 2 ))
    local pad_right=$(( 48 - ${#status_msg} - pad_left ))
    local status_line
    status_line=$(printf "  │%*s%s%*s│" "$pad_left" "" "$msg_display" "$pad_right" "")

    # Animated completion banner reveal
    gum style --foreground "$status_color" --bold "$box_top"
    sleep 0.03
    gum style --foreground "$status_color" --bold "$box_empty"
    sleep 0.03
    gum style --foreground "$status_color" --bold "$status_line"
    sleep 0.03
    gum style --foreground "$status_color" --bold "$box_empty"
    sleep 0.03
    gum style --foreground "$status_color" --bold "$box_bottom"
    echo ""

    # Stats panel (48 char internal width)
    gum style --foreground "$THEME_SUBTEXT" "  ╭─ SUMMARY ──────────────────────────────────────╮"
    sleep 0.02
    gum style --foreground "$THEME_SUBTEXT" "  │                                                │"

    # Show what was done
    if [[ "$total_new" -eq 0 ]] && [[ "$failed" -eq 0 ]]; then
        # Everything was already set up
        sleep 0.05
        gum style --foreground "$THEME_SUCCESS" "$(printf "  │  %-46s│" "All packages already configured")"
        gum style --foreground "$THEME_SUBTEXT" "  │                                                │"
        if [[ "$bin_exists" -gt 0 ]]; then
            gum style --foreground "$THEME_SUBTEXT" "$(printf "  │    %-44s│" "$bin_exists binaries already installed")"
        fi
        if [[ "$cfg_exists" -gt 0 ]]; then
            gum style --foreground "$THEME_SUBTEXT" "$(printf "  │    %-44s│" "$cfg_exists configs already linked")"
        fi
    else
        # Show new items first
        if [[ "$bin_new" -gt 0 ]]; then
            sleep 0.05
            gum style --foreground "$THEME_SUCCESS" "$(printf "  │  %-46s│" "$bin_new binaries installed")"
        fi
        if [[ "$cfg_new" -gt 0 ]]; then
            sleep 0.05
            gum style --foreground "$THEME_SUCCESS" "$(printf "  │  %-46s│" "$cfg_new configs linked")"
        fi

        # Show existing items
        if [[ "$bin_exists" -gt 0 ]] || [[ "$cfg_exists" -gt 0 ]]; then
            gum style --foreground "$THEME_SUBTEXT" "  │                                                │"
            if [[ "$bin_exists" -gt 0 ]]; then
                sleep 0.03
                gum style --foreground "$THEME_SUBTEXT" "$(printf "  │  %-46s│" "$bin_exists binaries already installed")"
            fi
            if [[ "$cfg_exists" -gt 0 ]]; then
                sleep 0.03
                gum style --foreground "$THEME_SUBTEXT" "$(printf "  │  %-46s│" "$cfg_exists configs already linked")"
            fi
        fi

        # Show failures
        if [[ "$failed" -gt 0 ]]; then
            gum style --foreground "$THEME_SUBTEXT" "  │                                                │"
            sleep 0.05
            gum style --foreground "$THEME_ERROR" "$(printf "  │  %-46s│" "$failed packages failed")"
        fi
    fi

    gum style --foreground "$THEME_SUBTEXT" "  │                                                │"
    gum style --foreground "$THEME_SUBTEXT" "  ╰────────────────────────────────────────────────╯"

    # Show failed packages if any
    if [[ "$failed" -gt 0 ]] && [[ -f "$csv_file" ]]; then
        echo ""
        sleep 0.1
        gum style --foreground "$THEME_ERROR" "  ╭─ FAILED ───────────────────────────────────────╮"
        gum style --foreground "$THEME_SUBTEXT" "  │                                                │"
        while IFS=',' read -r pkg bin_status cfg_status; do
            if [[ "$bin_status" == "Failed" ]] || [[ "$cfg_status" == "Failed" ]]; then
                local reason=""
                [[ "$bin_status" == "Failed" ]] && reason="binary"
                [[ "$cfg_status" == "Failed" ]] && reason="${reason:+$reason, }config"
                gum style --foreground "$THEME_SUBTEXT" "$(printf "  │  %-22s %-23s│" "$pkg" "($reason)")"
            fi
        done < <(tail -n +2 "$csv_file")
        gum style --foreground "$THEME_SUBTEXT" "  │                                                │"
        gum style --foreground "$THEME_ERROR" "  ╰────────────────────────────────────────────────╯"
        echo ""
        gum style --foreground "$THEME_SUBTEXT" --faint "  Run again to retry failed packages."
    fi

    echo ""
}
