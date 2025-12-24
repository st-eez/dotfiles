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

    # 3. UI Flow
    ui_header "Steez Dotfiles v2" "Modern setup for macOS & Linux"

    # Pre-flight check for stow
    if ! command -v stow >/dev/null 2>&1; then
        if ui_confirm "GNU Stow is missing. Install it?"; then
            install_package "stow"
        else
            gum style --foreground "$THEME_ERROR" "Stow is required for dotfiles management. Exiting."
            exit 1
        fi
    fi

    echo ""
    if ui_confirm "Do you want to select packages to install?"; then
        if ui_select_packages; then
            echo ""
            
            # Counters
            local success_count=0
            local fail_count=0

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
                if stow_package "$pkg"; then
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

        else
            echo "No packages selected."
        fi
    else
        echo "Skipping selection."
    fi
}

main "$@"
