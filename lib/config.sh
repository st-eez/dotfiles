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
    pnpm
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
    prettier
    ripgrep
    stow
    telnet
    wireguard-tools
    zoxide
    zsh
)

# Brew mappings: stow package → brew install command
declare -A PKG_BREW_MAP=(
  [aerospace]="--cask aerospace"
  [autoraise]="--cask autoraiseapp"
  [bitwarden]="--cask bitwarden"
  [borders]="borders"
  [ghostty]="--cask ghostty"
  [karabiner]="--cask karabiner-elements"
  [localsend]="--cask localsend"
  [nvim]="neovim"
  [raycast]="--cask raycast"
  [sketchybar]="sketchybar"
  [claude]="claude-code"
  [codex]="codex"
  [gemini]="gemini-cli"
  [btop]="btop"
  [eza]="eza"
  [fd]="fd"
  [fzf]="fzf"
  [gh]="gh"
  [git]="git"
  [lazygit]="lazygit"
  [ripgrep]="ripgrep"
  [zoxide]="zoxide"
  [node]="node"
  [pnpm]="pnpm"
  [prettier]="prettier"
  [lua]="lua"
  [stow]="stow"
  [nmap]="nmap"
  [telnet]="telnet"
  [wireguard-tools]="wireguard-tools"
)

# Pacman mappings: stow package → pacman/AUR package name
# Packages prefixed with "aur:" require an AUR helper (yay/paru)
declare -A PKG_PACMAN_MAP=(
  [nvim]="neovim"
  [btop]="btop"
  [eza]="eza"
  [fd]="fd"
  [fzf]="fzf"
  [gh]="github-cli"
  [git]="git"
  [lazygit]="lazygit"
  [ripgrep]="ripgrep"
  [zoxide]="zoxide"
  [node]="nodejs"
  [pnpm]="pnpm"
  [prettier]="prettier"
  [lua]="lua"
  [stow]="stow"
  [nmap]="nmap"
  [telnet]="inetutils"
  [wireguard-tools]="wireguard-tools"
  [ghostty]="aur:ghostty"
  [claude]="aur:claude-code-bin"
  [codex]="aur:codex"
  [gemini]="aur:gemini-cli"
)
