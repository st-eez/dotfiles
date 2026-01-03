#!/usr/bin/env bash

OS=""
DISTRO=""
export IS_OMARCHY=false

bootstrap_homebrew() {
    command -v brew >/dev/null 2>&1 && return 0
    
    local brew_path=""
    
    if [[ "$(uname -m)" == "arm64" ]]; then
        [[ -x /opt/homebrew/bin/brew ]] && brew_path="/opt/homebrew/bin/brew"
    else
        [[ -x /usr/local/bin/brew ]] && brew_path="/usr/local/bin/brew"
    fi
    
    if [[ -n "$brew_path" ]]; then
        eval "$($brew_path shellenv)"
        return 0
    fi
    
    echo "Error: Homebrew not found. Install it first:" >&2
    echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"" >&2
    return 1
}

detect_os() {
    case "$(uname -s)" in
        Darwin)
            OS="macos"
            DISTRO="macos"
            bootstrap_homebrew || exit 1
            ;;
        Linux)
            OS="linux"
            if [[ -f /etc/os-release ]]; then
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

detect_omarchy() {
    [[ "$DISTRO" != "arch" ]] && return
    command -v gum >/dev/null || return

    local omarchy_root="${HOME:?}/.local/share/omarchy"
    if [[ -d "$omarchy_root" && -d "$omarchy_root/bin" ]]; then
        IS_OMARCHY=true
        gum style --foreground "${THEME_ACCENT:-#73daca}" "  Detected: Omarchy environment"
    fi
}

check_sudo() {
    [[ "$OS" != "linux" ]] && return 0
    if ! sudo -n true 2>/dev/null; then
        echo "Sudo required. You may be prompted for your password."
        sudo -v || exit 1
    fi
}

ensure_apt_fresh() {
    [[ "$DISTRO" != "debian" ]] && return 0
    local stamp="${TMPDIR:-/tmp}/.steez_apt_updated"
    if [[ ! -f "$stamp" ]] || [[ $(find "$stamp" -mmin +60 2>/dev/null) ]]; then
        sudo apt-get update -qq && touch "$stamp"
    fi
}

install_gum() {
    if command -v gum >/dev/null 2>&1; then
        return 0
    fi

    echo "Gum not found. Installing..."
    check_sudo

    case "$DISTRO" in
        macos)
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

export_system_info() {
    detect_os
    echo "Detected OS: $OS ($DISTRO)"
}
