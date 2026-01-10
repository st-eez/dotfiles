#!/usr/bin/env bash

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║  STEEZ DOTFILES INSTALLER                                                  ║
# ║  Terminal Neo-Noir Edition                                                 ║
# ╚════════════════════════════════════════════════════════════════════════════╝

set -uo pipefail

readonly VERSION="2.1.0"
DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load bootstrap logic
if [[ -f "$DOTFILES_DIR/installer/bootstrap.sh" ]]; then
    # shellcheck disable=SC1091
    source "$DOTFILES_DIR/installer/bootstrap.sh"
else
    echo "Error: installer/bootstrap.sh not found."
    exit 1
fi

# Load Configuration & UI (all modules required)
for module in config theme logging ui install utils zsh_setup git_setup; do
    # shellcheck disable=SC1090
    source "$DOTFILES_DIR/installer/${module}.sh" || {
        echo "Error: installer/${module}.sh not found or failed to load."
        exit 1
    }
done

# ═══════════════════════════════════════════════════════════════════════════════
# SIGNAL HANDLING
# ═══════════════════════════════════════════════════════════════════════════════

# Cleanup function for graceful exit
cleanup() {
    local exit_code=$?
    # Restore cursor and terminal state
    tput cnorm 2>/dev/null
    stty echo 2>/dev/null
    if [[ $exit_code -ne 0 ]]; then
        echo ""
        if command -v gum >/dev/null 2>&1; then
            gum style --foreground "$THEME_WARNING" "  ⚠ Installation interrupted"
        else
            echo "Installation interrupted."
        fi
        echo ""
    fi
    exit $exit_code
}

trap cleanup EXIT
trap 'exit 130' INT   # Ctrl+C
trap 'exit 143' TERM  # kill

# ═══════════════════════════════════════════════════════════════════════════════
# INSTALLATION FLOW
# ═══════════════════════════════════════════════════════════════════════════════

run_installation() {
    local packages="$1"
    local run_timestamp
    run_timestamp=$(date +%Y%m%d_%H%M%S)

    # Convert to array for counting (proper quoting to avoid word splitting)
    local pkg_array=()
    IFS=' ' read -ra pkg_array <<< "$packages"
    local total=${#pkg_array[@]}
    local current=0

    # Detailed counters
    local bin_new=0      # Newly installed binaries
    local bin_exists=0   # Already installed binaries
    local cfg_new=0      # Newly linked configs
    local cfg_exists=0   # Already linked configs
    local fail_count=0   # Failed packages

    local csv_file
    csv_file=$(mktemp "${TMPDIR:-/tmp}/steez_install.XXXXXX") || return 1
    echo "Package,Binary,Config" > "$csv_file"

    echo ""
    log_section "Installing Packages"

    # Installation loop with progress
    for pkg in "${pkg_array[@]}"; do
        ((current++))

        # Progress header
        log_progress "$current" "$total" "$pkg"

        local pkg_failed=false
        local bin_status="—"
        local cfg_status="—"

        # A. Install Binary
        if is_installed "$pkg"; then
            log_info "Binary" "Already installed"
            bin_status="Exists"
            ((bin_exists++))
        else
            if install_package "$pkg"; then
                log_success "Binary" "Installed"
                bin_status="Installed"
                ((bin_new++))
            else
                log_failure "Binary" "Failed"
                pkg_failed=true
                bin_status="Failed"
            fi
        fi

        # B. Stow Configs
        stow_package "$pkg" "$run_timestamp"
        local stow_result=$?

        case $stow_result in
            0)
                log_success "Config" "Linked"
                cfg_status="Linked"
                ((cfg_new++))
                ;;
            2)
                log_info "Config" "No config"
                cfg_status="—"
                ;;
            3)
                log_info "Config" "Already linked"
                cfg_status="Exists"
                ((cfg_exists++))
                ;;
            *)
                log_failure "Config" "Failed"
                pkg_failed=true
                cfg_status="Failed"
                ;;
        esac

        # Track in CSV
        echo "$pkg,$bin_status,$cfg_status" >> "$csv_file"

        if [[ "$pkg_failed" == true ]]; then
            ((fail_count++))
        fi
    done

    # ═══════════════════════════════════════════════════════════════════════════════
    # POST-INSTALLATION SETUP
    # ═══════════════════════════════════════════════════════════════════════════════
    
    local fonts_ok=true zsh_ok=true git_ok=true

    # 1. Fonts
    install_nerd_fonts || { fonts_ok=false; ((fail_count++)); }

    # 2. Zsh
    if [[ " ${pkg_array[*]} " =~ " zsh " ]] || [[ "$SHELL" == */zsh ]]; then
        setup_zsh_env || { zsh_ok=false; ((fail_count++)); }
    fi

    # 3. Git
    if [[ " ${pkg_array[*]} " =~ " git " ]]; then
        setup_git_config || { git_ok=false; ((fail_count++)); }
    fi

    # 4. OpenCode
    if [[ -f "$HOME/.claude/CLAUDE.md" ]]; then
        local opencode_agents="$HOME/.config/opencode/AGENTS.md"
        if [[ ! -e "$opencode_agents" ]] || [[ -L "$opencode_agents" ]]; then
            ln -sf "$HOME/.claude/CLAUDE.md" "$opencode_agents"
            post_add "OPENCODE" "AGENTS.md" "Linked"
        else
            post_add "OPENCODE" "AGENTS.md" "Skipped (file exists)"
        fi
    fi

    # 5. Ghostty Desktop Integration (Debian only)
    if [[ " ${pkg_array[*]} " =~ " ghostty " ]] && [[ "$DISTRO" == "debian" ]]; then
        setup_ghostty_desktop || ((fail_count++))
    fi

    # 6. Theme Setup (macOS only, interactive)
    # Only show theme selection when packages that support theming are installed
    if [[ "$OS" == "macos" ]]; then
        # Packages that have theme integration
        local -a THEMEABLE_PKGS=(sketchybar ghostty nvim borders aerospace raycast opencode)
        
        # Check if any themeable package was selected
        local has_themeable=false
        for pkg in "${THEMEABLE_PKGS[@]}"; do
            if [[ " ${pkg_array[*]} " =~ " $pkg " ]]; then
                has_themeable=true
                break
            fi
        done
        
        if [[ "$has_themeable" == true ]]; then
            stow -d "$DOTFILES_DIR" -t "$HOME" themes 2>/dev/null || true
            
            local theme_script="$DOTFILES_DIR/themes/.local/bin/theme-set"
            if [[ -x "$theme_script" ]]; then
                # Discover available themes dynamically from themes/configs/
                local -a available_themes=()
                for d in "$DOTFILES_DIR/themes/configs"/*/; do
                    [[ -d "$d" ]] && available_themes+=("$(basename "$d")")
                done
                
                if [[ ${#available_themes[@]} -gt 0 ]]; then
                    local selected_theme
                    [[ -f "$HOME/.config/current-theme" ]] && selected_theme=$(<"$HOME/.config/current-theme")
                    
                    selected_theme=$(gum choose --header "Select theme:" \
                        --selected="${selected_theme:-tokyo-night}" \
                        "${available_themes[@]}")
                    
                    if DOTFILES="$DOTFILES_DIR" "$theme_script" "$selected_theme" >/dev/null 2>&1; then
                        post_add "THEME" "$selected_theme" "Applied"
                    else
                        post_add "THEME" "$selected_theme" "Failed"
                    fi
                fi
            fi
        fi
    fi

    # 6b. Raycast Theme Switcher (when themes selected)
    if [[ " ${pkg_array[*]} " =~ " themes " ]]; then
        if command -v npm >/dev/null 2>&1; then
            build_raycast_extension "theme-switcher" "Theme Switcher" || true
        else
            post_add "RAYCAST" "theme-switcher" "Skipped (npm not available)"
        fi
    fi

    # Render post-installation tree
    render_post_install_summary "$zsh_ok" "$git_ok" "$fonts_ok"

    # Show Raycast extension import instructions if any were built
    if [[ ${#RAYCAST_BUILT_EXTENSIONS[@]} -gt 0 ]]; then
        show_raycast_import_instructions
    fi

    # Summary with detailed stats
    ui_summary "$bin_new" "$bin_exists" "$cfg_new" "$cfg_exists" "$fail_count" "$csv_file"
    rm -f "$csv_file"

    # Show next steps reminder
    echo ""
    gum style \
        --border rounded \
        --border-foreground "$THEME_ACCENT" \
        --width 50 \
        --padding "0 1" \
        --margin "0 2" \
        "$(gum style --foreground "$THEME_ACCENT" --bold "NEXT STEPS")" \
        "" \
        "$(gum style --foreground "$THEME_TEXT" "Restart your terminal to apply all changes:")" \
        "" \
        "$(gum style --foreground "$THEME_SUBTEXT" "  • Close and reopen your terminal, or")" \
        "$(gum style --foreground "$THEME_SUBTEXT" "  • Run:") $(gum style --foreground "$THEME_PRIMARY" "exec zsh")"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

main() {
    if [[ "${1:-}" == "--version" || "${1:-}" == "-v" ]]; then
        if command -v gum >/dev/null 2>&1; then
            echo ""
            gum style --foreground "$THEME_PRIMARY" --bold "  ● Steez Dotfiles v$VERSION"
            echo ""
        else
            echo "Steez Dotfiles v$VERSION"
        fi
        exit 0
    fi

    if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
        if command -v gum >/dev/null 2>&1; then
            echo ""
            gum style --foreground "$THEME_PRIMARY" --bold "  ● Steez Dotfiles v$VERSION"
            echo ""
            printf '%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s' \
                "USAGE" "" "./install.sh [options]" "" \
                "OPTIONS" "" \
                "-v, --version   Show version" \
                "-h, --help      Show this help" | \
            gum style \
                --border rounded \
                --border-foreground "$THEME_SUBTEXT" \
                --width 44 \
                --padding "0 1" \
                --margin "0 2"
            echo ""
            gum style --foreground "$THEME_SUBTEXT" --faint "  https://github.com/steez/dotfiles"
            echo ""
        else
            cat << EOF
Steez Dotfiles v$VERSION

Usage: ./install.sh [options]

Options:
  -v, --version   Show version
  -h, --help      Show this help message

https://github.com/steez/dotfiles
EOF
        fi
        exit 0
    fi

    # 1. Bootstrap
    detect_os
    install_gum
    detect_omarchy  # Must run after install_gum (uses gum for styled output)

    # 2. Verify gum
    if ! command -v gum >/dev/null 2>&1; then
        echo "Error: gum is required but not installed."
        exit 1
    fi

    # 3. Splash Screen
    ui_splash "$VERSION"

    # 4. Pre-flight check for stow
    if ! command -v stow >/dev/null 2>&1; then
        echo ""
        log_warn "Dependency" "GNU Stow not found"
        if ui_confirm "Install GNU Stow now?"; then
            if ! install_package "stow"; then
                log_failure "Stow" "Installation failed"
                ui_error "Cannot proceed without Stow"
                exit 1
            fi
            log_success "Stow" "Installed"
        else
            ui_error "Stow is required. Exiting."
            exit 1
        fi
    fi

    # 5. Initialize global selection variable
    SELECTED_PACKAGES=""

    # 6. Main Menu
    local action
    action=$(ui_main_menu)

    case "$action" in
        "exit")
            ui_exit "Goodbye. Run ./install.sh anytime to continue."
            exit 0
            ;;
        "custom")
            if ! ui_select_packages; then
                ui_cancelled "No packages selected"
                exit 0
            fi
            ;;
        "full")
            # Auto-populate all compatible packages
            SELECTED_PACKAGES=""

            if [[ "$OS" == "macos" ]]; then
                for pkg in "${MACOS_PKGS[@]}"; do
                    SELECTED_PACKAGES+="$pkg "
                done
            fi

            for pkg in "${TERMINAL_PKGS[@]}"; do
                SELECTED_PACKAGES+="$pkg "
            done

            SELECTED_PACKAGES="${SELECTED_PACKAGES% }"
            ;;
    esac

    # 7. Run installation if we have packages
    if [[ -n "$SELECTED_PACKAGES" ]]; then
        # Count packages
        local pkg_count
        pkg_count=$(echo "$SELECTED_PACKAGES" | wc -w | tr -d ' ')

        # Pre-flight summary
        ui_preflight "$pkg_count"

        if ui_confirm "Proceed with installation?"; then
            run_installation "$SELECTED_PACKAGES"
        else
            ui_cancelled "Installation cancelled"
        fi
    fi
}

main "$@"
