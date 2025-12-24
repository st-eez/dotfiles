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

    # For now, just a placeholder to show it works
    gum style \
        --foreground 212 --border-foreground 212 --border double \
        --align center --width 50 --margin "1 2" --padding "2 4" \
        "Steez Dotfiles v2" "Gum is ready!"
}

main "$@"
