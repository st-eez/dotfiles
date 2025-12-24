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
    node
    pnpm
    prettier
    ripgrep
    stow
    telnet
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
get_pacman_pkg() {
    case "$1" in
        nvim)      echo "neovim" ;;
        gh)        echo "github-cli" ;;
        node)      echo "nodejs" ;;
        telnet)    echo "inetutils" ;;
        ghostty)   echo "aur:ghostty" ;;
        claude)    echo "aur:claude-code-bin" ;;
        codex)     echo "aur:codex" ;;
        gemini)    echo "aur:gemini-cli" ;;
        *)         echo "$1" ;; # Default: same name
    esac
}

# Helper: Get Apt package name
get_apt_pkg() {
    case "$1" in
        nvim)      echo "neovim" ;;
        fd)        echo "fd-find" ;;
        gh)        echo "gh" ;; # requires gh repo
        node)      echo "nodejs" ;;
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
        fd)              echo "fd" ;; # apt installs as fdfind but usually aliased or we check fdfind?
        *)               echo "$1" ;;
    esac
}
