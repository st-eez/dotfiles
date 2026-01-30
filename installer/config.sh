#!/usr/bin/env bash

# Configuration & Package Lists
# This file defines the packages managed by the installer.

# macOS-only GUI applications
export MACOS_PKGS=(
    aerospace
    autoraise
    bitwarden
    borders
    karabiner
    raycast
    sketchybar
    themes
)

# Shell & Terminal
export SHELL_PKGS=(
    ghostty
    starship
    tmux
    zsh
    zoxide
)

# Editor & Dev Tools
export DEV_PKGS=(
    nvim
    node
    python
    lua
    pnpm
    prettier
    stow
)

# AI Assistants
export AI_PKGS=(
    claude
    codex
    gemini
    opencode
)

# File & Search Tools
export FILE_PKGS=(
    eza
    fd
    fzf
    ripgrep
)

# Git & Version Control
export GIT_PKGS=(
    gh
    git
    lazygit
)

# System & Network
export SYSTEM_PKGS=(
    btop
    localsend
    nmap
    wireguard-tools
)

# Combined terminal packages (for backwards compatibility)
export TERMINAL_PKGS=(
    "${SHELL_PKGS[@]}"
    "${DEV_PKGS[@]}"
    "${AI_PKGS[@]}"
    "${FILE_PKGS[@]}"
    "${GIT_PKGS[@]}"
    "${SYSTEM_PKGS[@]}"
)

# Helper: Get Brew package name/args
get_brew_pkg() {
    case "$1" in
        aerospace) echo "--cask aerospace" ;;
        autoraise) echo "--cask autoraiseapp" ;;
        bitwarden) echo "--cask bitwarden" ;;
        borders)   echo "felixkratz/formulae/borders" ;;
        ghostty)   echo "--cask ghostty" ;;
        karabiner) echo "--cask karabiner-elements" ;;
        localsend) echo "--cask localsend" ;;
        nvim)      echo "neovim" ;;
        raycast)   echo "--cask raycast" ;;
        sketchybar) echo "sketchybar" ;;
        themes)    echo "" ;;  # Config-only, no brew package
        claude)    echo "claude-code" ;;
        codex)     echo "codex" ;;
        gemini)    echo "gemini-cli" ;;
        gh)        echo "gh" ;;
        node)      echo "node" ;;
        starship)  echo "starship" ;;
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
        localsend) echo "aur:localsend-bin" ;;
        codex)     echo "" ;;                     # Use npm: @openai/codex
        gemini)    echo "" ;;                     # Use npm: @google/gemini-cli
        opencode)  echo "" ;;                     # Use native installer
        prettier)  echo "" ;;                     # Use npm
        pnpm)      echo "" ;;                     # Use corepack
        starship)  echo "starship" ;;
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
        ghostty)   echo "" ;;   # No apt package - use AppImage
        claude)    echo "" ;;   # Use native installer
        localsend) echo "" ;;   # Use Flatpak
        codex)     echo "" ;;   # Use npm
        gemini)    echo "" ;;   # Use npm
        opencode)  echo "" ;;   # Use npm
        prettier)  echo "" ;;   # Use npm
        pnpm)      echo "" ;;   # Use corepack
        starship)  echo "" ;;   # Use native installer
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
        codex)           echo "codex" ;;
        gemini)          echo "gemini" ;;
        pnpm)            echo "pnpm" ;;
        prompt-optimizer) echo "" ;;
        themes)          echo "" ;;  # Config-only package, no binary
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

# Helper: Get package description for UI display
get_pkg_description() {
    case "$1" in
        # macOS Apps
        aerospace)    echo "Tiling window manager" ;;
        autoraise)    echo "Auto-focus windows on hover" ;;
        bitwarden)    echo "Password manager" ;;
        borders)      echo "Window border styling" ;;
        karabiner)    echo "Keyboard customization" ;;
        raycast)      echo "Launcher + keybinds/theme extensions" ;;
        prompt-optimizer) echo "AI prompt optimizer (Raycast)" ;;
        sketchybar)   echo "Custom menu bar" ;;
        themes)       echo "Theme switching system" ;;
        # Terminal Tools
        node)         echo "JavaScript runtime" ;;
        python)       echo "Python interpreter" ;;
        btop)         echo "System monitor" ;;
        claude)       echo "Claude AI CLI" ;;
        codex)        echo "OpenAI Codex CLI" ;;
        eza)          echo "Modern ls replacement" ;;
        fd)           echo "Fast file finder" ;;
        fzf)          echo "Fuzzy finder" ;;
        gemini)       echo "Google Gemini CLI" ;;
        gh)           echo "GitHub CLI" ;;
        ghostty)      echo "GPU-accelerated terminal" ;;
        git)          echo "Version control" ;;
        lazygit)      echo "Git TUI" ;;
        localsend)    echo "Local file sharing" ;;
        lua)          echo "Lua interpreter" ;;
        nmap)         echo "Network scanner" ;;
        nvim)         echo "Neovim + LazyVim" ;;
        opencode)     echo "OpenCode AI assistant" ;;
        pnpm)         echo "Fast package manager" ;;
        prettier)     echo "Code formatter" ;;
        ripgrep)      echo "Fast grep replacement" ;;
        starship)     echo "Cross-shell prompt" ;;
        stow)         echo "Symlink farm manager" ;;
        tmux)         echo "Terminal multiplexer" ;;
        wireguard-tools) echo "VPN tools" ;;
        zoxide)       echo "Smart cd command" ;;
        zsh)          echo "Z shell" ;;
        *)            echo "" ;;
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
            # Linux: use native installer (brew handles macOS)
            [[ "$OS" != "macos" ]] && echo "native:curl -fsSL https://opencode.ai/install | bash"
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
        starship)
            # Debian/Ubuntu/Mint: apt version often outdated, use official script
            [[ "$DISTRO" == "debian" ]] && echo "native:install_starship_script"
            ;;
        localsend)
            [[ "$DISTRO" == "debian" ]] && echo "native:install_localsend_linux"
            ;;
        *)         echo "" ;;
    esac
}
