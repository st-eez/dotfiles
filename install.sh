#!/usr/bin/env bash

# Steez Dotfiles Installer v2
# Modernized installer using Charm Gum

set -uo pipefail

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load bootstrap logic
if [[ -f "$DOTFILES_DIR/lib/bootstrap.sh" ]]; then
    # shellcheck disable=SC1091
    source "$DOTFILES_DIR/lib/bootstrap.sh"
else
    echo "Error: lib/bootstrap.sh not found."
    exit 1
fi

# Load Configuration & UI
source "$DOTFILES_DIR/lib/config.sh"
source "$DOTFILES_DIR/lib/theme.sh"
source "$DOTFILES_DIR/lib/logging.sh"
source "$DOTFILES_DIR/lib/ui.sh"
source "$DOTFILES_DIR/lib/install.sh"
source "$DOTFILES_DIR/lib/utils.sh"

# Main execution flow
main() {
    # Handle flags
    if [[ "${1:-}" == "--version" || "${1:-}" == "-v" ]]; then
        echo "Steez Dotfiles v2.0.0"
        exit 0
    fi

    if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
        echo "Usage: ./install.sh [options]"
        echo ""
        echo "Options:"
        echo "  -v, --version   Show version"
        echo "  -h, --help      Show this help message"
        exit 0
    fi

    # 1. Bootstrap
    detect_os
    install_gum

    # 2. Verify gum
    if ! command -v gum >/dev/null 2>&1; then
        echo "Error: gum is required but not installed."
        exit 1
    fi

    # 3. UI Flow - Splash Screen
    ui_splash "2.0.0"

    # Pre-flight check for stow
    if ! command -v stow >/dev/null 2>&1; then
        if ui_confirm "GNU Stow is missing. Install it?"; then
            if ! install_package "stow"; then
                gum style --foreground "$THEME_ERROR" "Failed to install Stow. Exiting."
                exit 1
            fi
        else
            gum style --foreground "$THEME_ERROR" "Stow is required for dotfiles management. Exiting."
            exit 1
        fi
    fi

    echo ""
    
    # Initialize global selection variable
    SELECTED_PACKAGES=""
    
    # Main Menu
    local action
    action=$(gum choose \
        --header "Choose an installation mode" \
        --header.foreground "$THEME_PRIMARY" \
        --cursor.foreground "$THEME_PRIMARY" \
        --item.foreground "$THEME_TEXT" \
        --selected.foreground "$THEME_PRIMARY" \
        "Full Setup (Recommended)" \
        "Custom Selection" \
        "Exit")

    if [[ "$action" == "Exit" ]]; then
        gum style --foreground "$THEME_SUBTEXT" "Exiting..."
        exit 0
    fi

    if [[ "$action" == "Custom Selection" ]]; then
        if ! ui_select_packages; then
            gum style --foreground "$THEME_WARNING" "No packages selected."
            exit 0
        fi
    elif [[ "$action" == "Full Setup (Recommended)" ]]; then
        # Auto-populate all compatible packages
        SELECTED_PACKAGES=""
        
        # 1. macOS Packages
        if [[ "$OS" == "macos" ]]; then
            for pkg in "${MACOS_PKGS[@]}"; do
                SELECTED_PACKAGES+="$pkg "
            done
        fi

        # 2. Terminal Packages (All OS)
        for pkg in "${TERMINAL_PKGS[@]}"; do
            SELECTED_PACKAGES+="$pkg "
        done
        
        # Trim trailing space
        SELECTED_PACKAGES="${SELECTED_PACKAGES% }"
    fi

    # Proceed if we have packages
    if [[ -n "$SELECTED_PACKAGES" ]]; then
        echo ""
        
        # Counters
        local success_count=0
            local fail_count=0
            
            # Global timestamp for this run (for consistent backups)
            local run_timestamp
            run_timestamp=$(date +%Y%m%d_%H%M%S)

            # 4. Installation Loop
            for pkg in $SELECTED_PACKAGES; do
                ui_header "Package: $pkg" ""
                local pkg_failed=false
                
                # A. Install Binary
                if is_installed "$pkg"; then
                    gum style --foreground "$THEME_SUCCESS" "  ✔ Binary already installed"
                else
                    if install_package "$pkg"; then
                        gum style --foreground "$THEME_SUCCESS" "  ✔ Installed successfully"
                    else
                        gum style --foreground "$THEME_ERROR" "  ✘ Installation failed"
                        pkg_failed=true
                    fi
                fi

                # B. Stow Configs
                if stow_package "$pkg" "$run_timestamp"; then
                    gum style --foreground "$THEME_SUCCESS" "  ✔ Configs linked"
                else
                     gum style --foreground "$THEME_ERROR" "  ✘ Linking failed"
                     pkg_failed=true
                fi
                echo ""

                if [[ "$pkg_failed" == true ]]; then
                    ((fail_count++))
                else
                    ((success_count++))
                fi
            done
            
            # Summary
            echo ""
            ui_header "Summary" ""
            gum style --foreground "$THEME_SUCCESS" "  ✔ Successful: $success_count"
            if [[ $fail_count -gt 0 ]]; then
                gum style --foreground "$THEME_ERROR" "  ✘ Failed:     $fail_count"
            else
                gum style --foreground "$THEME_SUBTEXT" "  ✘ Failed:     0"
            fi
            echo ""
            gum style --foreground "$THEME_SUCCESS" --border normal --padding "1 2" "Installation Complete!"

    fi
}

main "$@"
