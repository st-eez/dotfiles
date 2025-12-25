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
                # Extract only ID to avoid polluting namespace with all os-release vars
                local os_id
                os_id=$(grep -E '^ID=' /etc/os-release | cut -d= -f2 | tr -d '"')
                case "$os_id" in
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

# Check for sudo access (prompts once if needed)
check_sudo() {
    [[ "$OS" != "linux" ]] && return 0
    if ! sudo -n true 2>/dev/null; then
        echo "Sudo required. You may be prompted for your password."
        sudo -v || exit 1
    fi
}

# Ensure apt cache is fresh (runs at most once per session)
ensure_apt_fresh() {
    [[ "$DISTRO" != "debian" ]] && return 0
    local stamp="${TMPDIR:-/tmp}/.steez_apt_updated"
    if [[ ! -f "$stamp" ]] || [[ $(find "$stamp" -mmin +60 2>/dev/null) ]]; then
        sudo apt-get update -qq && touch "$stamp"
    fi
}

# Install Charm Gum dependency
install_gum() {
    if command -v gum >/dev/null 2>&1; then
        return 0
    fi

    echo "Gum not found. Installing..."

    # Prompt for sudo early on Linux
    check_sudo

    case "$DISTRO" in
        macos)
            if ! command -v brew >/dev/null 2>&1; then
                echo "Error: Homebrew is required to install gum on macOS."
                exit 1
            fi
            brew install gum
            ;;
        arch)
            sudo pacman -S --noconfirm --needed gum
            ;;
        debian)
            sudo mkdir -p /etc/apt/keyrings
            if ! command -v curl >/dev/null 2>&1 || ! command -v gpg >/dev/null 2>&1; then
                echo "Installing curl and gpg for keyring setup..."
                ensure_apt_fresh
                sudo apt install -y curl gpg
            fi
            curl -fsSL https://repo.charm.sh/apt/gpg.key | sudo gpg --batch --yes --dearmor -o /etc/apt/keyrings/charm.gpg
            echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" | sudo tee /etc/apt/sources.list.d/charm.list
            # Must update after adding new repo source
            sudo apt-get update -qq && sudo apt install -y gum
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
