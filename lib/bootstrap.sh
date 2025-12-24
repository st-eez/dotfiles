#!/usr/bin/env bash

# OS Detection and Bootstrapping
# This module handles identifying the system and ensuring core dependencies exist.

# Global variables to store system info
OS=""
DISTRO=""

# Detect Operating System and Distribution
detect_os() {
    case "$(uname -s)" in
        Darwin)
            OS="macos"
            DISTRO="macos"
            ;;
        Linux)
            OS="linux"
            if [[ -f /etc/os-release ]]; then
                # shellcheck disable=SC1091
                source /etc/os-release
                case "$ID" in
                    arch|endeavouros|manjaro|garuda)
                        DISTRO="arch"
                        ;;
                    ubuntu|debian|pop|linuxmint)
                        DISTRO="debian"
                        ;;
                    *)
                        DISTRO="unknown"
                        ;;
                esac
            else
                DISTRO="unknown"
            fi
            ;;
        *)
            echo "Error: Unsupported Operating System: $(uname -s)"
            exit 1
            ;;
    esac
}

# Install Charm Gum dependency
install_gum() {
    if command -v gum >/dev/null 2>&1; then
        return 0
    fi

    echo "Gum not found. Installing..."

    case "$DISTRO" in
        macos)
            if ! command -v brew >/dev/null 2>&1; then
                echo "Error: Homebrew is required to install gum on macOS."
                exit 1
            fi
            brew install gum
            ;;
        arch)
            sudo pacman -S --noconfirm gum
            ;;
        debian)
            sudo mkdir -p /etc/apt/keyrings
            if ! command -v curl >/dev/null 2>&1 || ! command -v gpg >/dev/null 2>&1; then
                echo "Installing curl and gpg for keyring setup..."
                sudo apt update && sudo apt install -y curl gpg
            fi
            curl -fsSL https://repo.charm.sh/apt/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/charm.gpg
            echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" | sudo tee /etc/apt/sources.list.d/charm.list
            sudo apt update && sudo apt install -y gum
            ;;
        *)
            echo "Error: Automatic installation of 'gum' is not supported on $DISTRO."
            echo "Please install it manually: https://github.com/charmbracelet/gum"
            exit 1
            ;;
    esac

    if ! command -v gum >/dev/null 2>&1; then
        echo "Error: Failed to install gum."
        exit 1
    fi
}

# Export system variables
export_system_info() {
    detect_os
    echo "Detected OS: $OS ($DISTRO)"
}
