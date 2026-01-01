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

ui_splash() {
    local version="${1:-2.0.0}"

    local sys_info
    sys_info=$(_get_system_info)
    IFS='|' read -r os_info arch_info shell_info term_info <<< "$sys_info"

    local metadata="$os_info ($arch_info)  $BULLET  $shell_info  $BULLET  $term_info"

    log_title "Dotfiles Installer v$version" "$metadata"

    echo ""
    gum style \
        --border rounded \
        --border-foreground "$THEME_SUBTEXT" \
        --width 40 \
        --padding "0 1" \
        --margin "0 2" \
        "$(gum style --foreground "$THEME_PRIMARY" --bold "SYSTEM")" \
        "" \
        "$(gum style --foreground "$THEME_SUBTEXT" --faint "$(printf "%-6s" "OS")")$(gum style --foreground "$THEME_TEXT" "$os_info")" \
        "$(gum style --foreground "$THEME_SUBTEXT" --faint "$(printf "%-6s" "ARCH")")$(gum style --foreground "$THEME_TEXT" "$arch_info")" \
        "$(gum style --foreground "$THEME_SUBTEXT" --faint "$(printf "%-6s" "SHELL")")$(gum style --foreground "$THEME_TEXT" "$shell_info")" \
        "$(gum style --foreground "$THEME_SUBTEXT" --faint "$(printf "%-6s" "TERM")")$(gum style --foreground "$THEME_TEXT" "$term_info")"
    echo ""
}

# Run a command with a spinner
# Usage: ui_spin "message" command [args...]
ui_spin() {
    local title="$1"
    shift
    gum spin \
        --spinner points \
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
    for ((i=0; i<filled; i++)); do bar+="▰"; done
    for ((i=0; i<empty; i++)); do bar+="▱"; done

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

ui_exit() {
    local message="${1:-Goodbye}"
    echo ""
    gum style \
        --border rounded \
        --border-foreground "$THEME_SUBTEXT" \
        --width 40 \
        --padding "0 1" \
        --margin "0 2" \
        --faint \
        "$message"
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

_select_category() {
    local category_name="$1"
    local -n pkg_array="$2"
    local height="${3:-8}"

    [[ ${#pkg_array[@]} -eq 0 ]] && return

    local items=()
    for pkg in "${pkg_array[@]}"; do
        local desc
        desc=$(get_pkg_description "$pkg")
        items+=("$(printf "%-14s" "$pkg")$(gum style --foreground "$THEME_SUBTEXT" --faint "$desc")")
    done

    echo ""
    gum style --foreground "$THEME_SECONDARY" --bold "  ─── $category_name (${#pkg_array[@]}) ───"

    local selection
    selection=$(gum choose \
        --no-limit \
        --height "$height" \
        --header.foreground "$THEME_SECONDARY" \
        --cursor "▸ " \
        --cursor.foreground "$THEME_ACCENT" \
        --selected.foreground "$THEME_SUCCESS" \
        --unselected-prefix "○ " \
        --selected-prefix "● " \
        "${items[@]}")

    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        local pkg_name="${line%% *}"
        SELECTED_PACKAGES+="$pkg_name "
    done <<< "$selection"
}

ui_select_packages() {
    local total_count=0

    if [[ "$OS" == "macos" ]]; then
        total_count=$((total_count + ${#MACOS_PKGS[@]}))
    fi
    total_count=$((total_count + ${#SHELL_PKGS[@]} + ${#DEV_PKGS[@]} + ${#AI_PKGS[@]} + ${#FILE_PKGS[@]} + ${#GIT_PKGS[@]} + ${#SYSTEM_PKGS[@]}))

    gum style \
        --border rounded \
        --border-foreground "$THEME_SUBTEXT" \
        --width 40 \
        --padding "0 1" \
        --margin "0 2" \
        "$(gum style --foreground "$THEME_PRIMARY" --bold "PACKAGES") $(gum style --foreground "$THEME_SUBTEXT" --faint "($total_count available)")" \
        "" \
        "$(gum style --foreground "$THEME_SUBTEXT" --faint "Space to select, Enter to confirm")"

    SELECTED_PACKAGES=""

    [[ "$OS" == "macos" ]] && _select_category "macOS Apps" MACOS_PKGS 10
    _select_category "Shell & Terminal" SHELL_PKGS 6
    _select_category "Editor & Dev Tools" DEV_PKGS 9
    _select_category "AI Assistants" AI_PKGS 6
    _select_category "File & Search" FILE_PKGS 6
    _select_category "Git & Version Control" GIT_PKGS 5
    _select_category "System & Network" SYSTEM_PKGS 6

    SELECTED_PACKAGES="${SELECTED_PACKAGES% }"

    if [[ -z "$SELECTED_PACKAGES" ]]; then
        return 1
    fi

    local selected_count
    selected_count=$(echo "$SELECTED_PACKAGES" | wc -w | tr -d ' ')
    echo ""
    gum style --foreground "$THEME_ACCENT" "  ● $selected_count packages selected"

    return 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN MENU & FLOW
# ═══════════════════════════════════════════════════════════════════════════════

ui_main_menu() {
    gum style \
        --border rounded \
        --border-foreground "$THEME_SUBTEXT" \
        --width 40 \
        --padding "0 1" \
        --margin "0 2" \
        "$(gum style --foreground "$THEME_PRIMARY" --bold "INSTALLATION MODE")" \
        "" \
        "$(gum style --foreground "$THEME_SUBTEXT" --faint "Select an option below")" >&2
    echo "" >&2

    local choice
    choice=$(gum choose \
        --cursor "  ▸ " \
        --cursor.foreground "$THEME_ACCENT" \
        --header.foreground "$THEME_SECONDARY" \
        --item.foreground "$THEME_TEXT" \
        --selected.foreground "$THEME_PRIMARY" \
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

ui_preflight() {
    local count="$1"

    local pkg_mgr="package manager"
    [[ "$DISTRO" == "macos" ]] && pkg_mgr="Homebrew"
    [[ "$DISTRO" == "arch" ]] && pkg_mgr="pacman"
    [[ "$DISTRO" == "debian" ]] && pkg_mgr="apt"

    echo ""
    gum style \
        --border rounded \
        --border-foreground "$THEME_SUBTEXT" \
        --width 44 \
        --padding "0 1" \
        --margin "0 2" \
        "$(gum style --foreground "$THEME_PRIMARY" --bold "PRE-FLIGHT") $(gum style --foreground "$THEME_SUBTEXT" --faint "($count items)")" \
        "" \
        "$(gum style --foreground "$THEME_TEXT" "Ready to install via $pkg_mgr")" \
        "" \
        "$(gum style --foreground "$THEME_SECONDARY" "•") Install binaries" \
        "$(gum style --foreground "$THEME_SECONDARY" "•") Symlink dotfiles" \
        "$(gum style --foreground "$THEME_SECONDARY" "•") Backup existing configs"
    echo ""
}

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

    local status_color="$THEME_SUCCESS"
    local status_text="SUCCESS"
    if [[ "$failed" -gt 0 ]]; then
        status_color="$THEME_WARNING"
        status_text="PARTIAL SUCCESS"
        if [[ "$total_new" -eq 0 ]] && [[ "$total_exists" -eq 0 ]]; then
            status_color="$THEME_ERROR"
            status_text="FAILED"
        fi
    fi

    gum style --foreground "$status_color" --bold "  ● INSTALLATION $status_text"
    echo ""

    local summary_lines=()
    summary_lines+=("$(gum style --foreground "$THEME_PRIMARY" --bold "SUMMARY")")
    summary_lines+=("")

    if [[ "$total_new" -eq 0 ]] && [[ "$failed" -eq 0 ]]; then
        summary_lines+=("$(gum style --foreground "$THEME_SUCCESS" "All packages already configured")")
        [[ "$bin_exists" -gt 0 ]] && summary_lines+=("• $bin_exists binaries installed")
        [[ "$cfg_exists" -gt 0 ]] && summary_lines+=("• $cfg_exists configs linked")
    else
        [[ "$bin_new" -gt 0 ]] && summary_lines+=("$(gum style --foreground "$THEME_SUCCESS" "+ $bin_new binaries installed")")
        [[ "$cfg_new" -gt 0 ]] && summary_lines+=("$(gum style --foreground "$THEME_SUCCESS" "+ $cfg_new configs linked")")

        if [[ "$bin_exists" -gt 0 ]] || [[ "$cfg_exists" -gt 0 ]]; then
            summary_lines+=("")
            [[ "$bin_exists" -gt 0 ]] && summary_lines+=("• $bin_exists binaries existed")
            [[ "$cfg_exists" -gt 0 ]] && summary_lines+=("• $cfg_exists configs existed")
        fi

        if [[ "$failed" -gt 0 ]]; then
            summary_lines+=("")
            summary_lines+=("$(gum style --foreground "$THEME_ERROR" "! $failed packages failed")")
        fi
    fi

    gum style \
        --border rounded \
        --border-foreground "$THEME_SUBTEXT" \
        --width 40 \
        --padding "0 1" \
        --margin "0 2" \
        "${summary_lines[@]}"

    if [[ "$failed" -gt 0 ]] && [[ -f "$csv_file" ]]; then
        echo ""
        local failure_lines=()
        failure_lines+=("$(gum style --foreground "$THEME_ERROR" --bold "FAILURES")")
        failure_lines+=("")
        while IFS=',' read -r pkg bin_status cfg_status; do
            if [[ "$bin_status" == "Failed" ]] || [[ "$cfg_status" == "Failed" ]]; then
                local reason=""
                [[ "$bin_status" == "Failed" ]] && reason="binary"
                [[ "$cfg_status" == "Failed" ]] && reason="${reason:+$reason, }config"
                failure_lines+=("$pkg ($reason)")
            fi
        done < <(tail -n +2 "$csv_file")

        gum style \
            --border rounded \
            --border-foreground "$THEME_ERROR" \
            --width 40 \
            --padding "0 1" \
            --margin "0 2" \
            "${failure_lines[@]}"

        echo ""
        gum style --foreground "$THEME_SUBTEXT" --faint "  Run again to retry failed packages."
    fi

    echo ""
}
