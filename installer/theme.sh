#!/usr/bin/env bash

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║  TERMINAL-ADAPTIVE THEME                                                   ║
# ║  Uses ANSI palette indices (0-15) instead of hardcoded hex colors          ║
# ╠════════════════════════════════════════════════════════════════════════════╣
# ║  These color numbers are resolved by the terminal emulator (Ghostty),      ║
# ║  which defines the actual hex values per theme:                            ║
# ║                                                                            ║
# ║    - Tokyo Night:  Blue (#7aa2f7), Cyan (#7dcfff), Green (#9ece6a)         ║
# ║    - Gruvbox:      Blue (#83a598), Cyan (#8ec07c), Green (#b8bb26)         ║
# ║    - Everforest:   Blue (#7fbbb3), Cyan (#83c092), Green (#a7c080)         ║
# ║                                                                            ║
# ║  This approach mirrors how starship.toml uses "cyan" and "bold cyan"       ║
# ║  to inherit colors from the active terminal theme.                         ║
# ╚════════════════════════════════════════════════════════════════════════════╝

# ═══════════════════════════════════════════════════════════════════════════════
# ANSI PALETTE (0-15)
# Standard terminal colors - actual hex values defined by Ghostty theme
# ═══════════════════════════════════════════════════════════════════════════════

export COLOR_BLACK="0"
export COLOR_RED="1"
export COLOR_GREEN="2"
export COLOR_YELLOW="3"
export COLOR_BLUE="4"
export COLOR_MAGENTA="5"
export COLOR_CYAN="6"
export COLOR_WHITE="7"

export COLOR_BRIGHT_BLACK="8"
export COLOR_BRIGHT_RED="9"
export COLOR_BRIGHT_GREEN="10"
export COLOR_BRIGHT_YELLOW="11"
export COLOR_BRIGHT_BLUE="12"
export COLOR_BRIGHT_MAGENTA="13"
export COLOR_BRIGHT_CYAN="14"
export COLOR_BRIGHT_WHITE="15"

export THEME_PRIMARY="$COLOR_BLUE"
export THEME_SECONDARY="$COLOR_CYAN"
export THEME_ACCENT="$COLOR_MAGENTA"
export THEME_SUCCESS="$COLOR_GREEN"
export THEME_WARNING="$COLOR_YELLOW"
export THEME_ERROR="$COLOR_RED"
export THEME_TEXT="$COLOR_WHITE"
export THEME_SUBTEXT="$COLOR_WHITE"

export COLOR_BG="$COLOR_BLACK"
