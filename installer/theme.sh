#!/usr/bin/env bash

# Tokyo Night Theme Definitions for Gum
# Source: Official Palette provided by User

# Core Palette (Night)
export COLOR_RED="#f7768e"
export COLOR_ORANGE="#ff9e64"
export COLOR_YELLOW="#e0af68"
export COLOR_GREEN="#9ece6a"      # Strings / Standard Green
export COLOR_TEAL="#73daca"       # Object Keys / Terminal Green
export COLOR_CYAN="#7dcfff"       # Terminal Cyan / Markdown Headings
export COLOR_BLUE="#7aa2f7"       # Function names / Terminal Blue
export COLOR_MAGENTA="#bb9af7"    # Control Keywords
export COLOR_WHITE="#c0caf5"      # Variables / Terminal White
export COLOR_COMMENT="#565f89"    # Comments
export COLOR_BG="#1a1b26"         # Editor Background (Night)

# Semantic Mappings - ADJUSTED FOR BLUE DOMINANCE
export THEME_PRIMARY="$COLOR_BLUE"      # #7aa2f7 - Main Brand Color
export THEME_SECONDARY="$COLOR_CYAN"    # #7dcfff - Secondary Highlights (was Purple)
export THEME_ACCENT="$COLOR_TEAL"       # #73daca - Accents (was Cyan)
export THEME_SUCCESS="$COLOR_GREEN"     # #9ece6a - Success messages
export THEME_WARNING="$COLOR_YELLOW"    # #e0af68 - Warnings
export THEME_ERROR="$COLOR_RED"         # #f7768e - Errors
export THEME_TEXT="$COLOR_WHITE"        # #c0caf5 - Standard Text
export THEME_SUBTEXT="$COLOR_COMMENT"   # #565f89 - Dimmed Info