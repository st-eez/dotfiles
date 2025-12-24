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

# Main execution flow
main() {
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

    echo ""
    if ui_confirm "Do you want to select packages to install?"; then
        if ui_select_packages; then
            echo ""
            gum style \
                --foreground "$THEME_SUCCESS" \
                --border "$THEME_SUCCESS" \
                --padding "1 2" \
                "Selected packages: $SELECTED_PACKAGES"
        else
            echo "No packages selected."
        fi
    else
        echo "Skipping selection."
    fi
}

main "$@"
