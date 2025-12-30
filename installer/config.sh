#!/usr/bin/env bash

# Configuration & Package Lists
# This file defines the packages managed by the installer.

# Package Groups (Stowed: has a folder in repo)
export MACOS_PKGS=(
    aerospace
    autoraise
    bitwarden
    borders
    karabiner
    localsend
    raycast
    sketchybar
)

export TERMINAL_PKGS=(
    node
    python
    btop
    claude
    codex
    eza
    fd
    fzf
    gemini
    gh
    ghostty
    git
    lazygit
    lua
    nmap
    nvim
    opencode
    pnpm
    prettier
    ripgrep
    stow
    wireguard-tools
    zoxide
    zsh
)

# Helper: Get Brew package name/args
get_brew_pkg() {
    case "$1" in
        aerospace) echo "--cask aerospace" ;;
        autoraise) echo "--cask autoraiseapp" ;;
        bitwarden) echo "--cask bitwarden" ;;
        borders)   echo "borders" ;;
        ghostty)   echo "--cask ghostty" ;;
        karabiner) echo "--cask karabiner-elements" ;;
        localsend) echo "--cask localsend" ;;
        nvim)      echo "neovim" ;;
        raycast)   echo "--cask raycast" ;;
        sketchybar) echo "sketchybar" ;;
        claude)    echo "claude-code" ;;
        codex)     echo "codex" ;;
        gemini)    echo "gemini-cli" ;;
        gh)        echo "gh" ;;
        node)      echo "node" ;;
        *)         echo "$1" ;; # Default: same name
    esac
}

# Helper: Get Pacman/AUR package name
# Prefix with "aur:" for AUR packages
# Return empty string for packages that need alternative installation
get_pacman_pkg() {
    case "$1" in
        nvim)      echo "neovim" ;;
        gh)        echo "github-cli" ;;
        node)      echo "nodejs" ;;
        python)    echo "python" ;;
        telnet)    echo "inetutils" ;;
        ghostty)   echo "ghostty" ;;              # Now in official repo (was AUR)
        claude)    echo "aur:claude-code-bin" ;;
        codex)     echo "" ;;                     # Use npm: @openai/codex
        gemini)    echo "" ;;                     # Use npm: @google/gemini-cli
        opencode)  echo "" ;;                     # Use npm: opencode
        prettier)  echo "" ;;                     # Use npm
        pnpm)      echo "" ;;                     # Use corepack
        *)         echo "$1" ;; # Default: same name
    esac
}

# Helper: Get Apt package name
# Return empty string for packages that need alternative installation
get_apt_pkg() {
    case "$1" in
        nvim)      echo "" ;;   # Use tarball (apt version too old for LazyVim)
        fd)        echo "fd-find" ;;
        gh)        echo "gh" ;;
        node)      echo "nodejs" ;;
        python)    echo "python3" ;;
        lua)       echo "lua5.4" ;;
        ghostty)   echo "" ;;   # No apt package - build from source
        claude)    echo "" ;;   # Use native installer
        codex)     echo "" ;;   # Use npm
        gemini)    echo "" ;;   # Use npm
        opencode)  echo "" ;;   # Use npm
        prettier)  echo "" ;;   # Use npm
        pnpm)      echo "" ;;   # Use corepack
        *)         echo "$1" ;; # Default: same name
    esac
}

# Helper: Get Binary Name (for checking installation)
get_binary_name() {
    case "$1" in
        ripgrep)         echo "rg" ;;
        nvim)            echo "nvim" ;;
        wireguard-tools) echo "wg" ;;
        claude)          echo "claude" ;;
        gemini)          echo "gemini" ;;
        codex)           echo "codex" ;;
        pnpm)            echo "pnpm" ;;
        fd)
            if [[ "$DISTRO" == "debian" ]]; then
                echo "fdfind"
            else
                echo "fd"
            fi
            ;;
        python)
            # macOS/Debian use python3, Arch uses python
            if [[ "$DISTRO" == "arch" ]]; then
                echo "python"
            else
                echo "python3"
            fi
            ;;
        *)               echo "$1" ;;
    esac
}

# Helper: Get alternative installation method for packages without system packages
# Returns: "method:target" or empty string if system package should be used
# Methods: npm, corepack, native, manual
get_alt_install_method() {
    case "$1" in
        prettier)  echo "npm:prettier" ;;
        pnpm)      echo "corepack:pnpm" ;;
        codex)     echo "npm:@openai/codex" ;;
        gemini)    echo "npm:@google/gemini-cli" ;;
        opencode)
            # Linux: use npm (brew handles macOS)
            [[ "$OS" != "macos" ]] && echo "npm:opencode"
            ;;
        claude)
            # Only use native installer on non-macOS (brew handles macOS)
            [[ "$OS" != "macos" ]] && echo "native:curl -fsSL https://claude.ai/install.sh | bash"
            ;;
        node)
            # Ubuntu/Mint repos have Node 18; npm packages need Node 20+
            [[ "$DISTRO" == "debian" ]] && echo "native:install_node_nodesource"
            ;;
        nvim)
            # Ubuntu/Mint repos have outdated neovim; LazyVim v15 requires 0.11.2+
            [[ "$DISTRO" == "debian" ]] && echo "native:install_nvim_tarball"
            ;;
        ghostty)
            # Debian/Ubuntu/Mint: use AppImage (no official apt package)
            # Arch has official package, macOS has cask
            [[ "$DISTRO" == "debian" ]] && echo "native:install_ghostty_appimage"
            ;;
        *)         echo "" ;;
    esac
}
