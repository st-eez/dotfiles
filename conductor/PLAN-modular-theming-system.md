# Modular macOS Theming System - Implementation Plan

**Created**: 2025-12-29
**Updated**: 2025-12-29
**Status**: Ready for Implementation (validated by Oracle)

## Validation Summary

Plan validated against codebase and Oracle review. Key fixes applied:

- macOS `sed -i ''` syntax for BSD compatibility
- Mandatory `theme-set tokyo-night` post-Stow in install.sh
- Neovim multi-theme plugin structure with all 3 colorscheme plugins
- P10k uses **truecolor** (`#RRGGBB`) format
- Single Obsidian vault path
- Aerospace/Raycast explicitly out of scope

## Overview

A zero-dependency theming system that enables one-command theme switching across macOS apps. Uses central palette files and pre-built per-app configs, self-contained within dotfiles.

**Themes**: Tokyo Night (default), Gruvbox, Everforest

---

## Key Decisions (from validation)

| Decision               | Approach                                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stow compatibility** | Theme-variable files (colors.lua, bordersrc, neovim.lua) are NOT Stow'd. They live in `themes/configs/` and are SYMLINKED to destinations by `theme-set`.      |
| **Symlink approach**   | Omarchy-style: `theme-set` creates symlinks from destination → `themes/configs/<theme>/`. Atomic switching, no file copying. See "Symlink Architecture" below. |
| **P10k theming**       | External source file using **truecolor** (`#RRGGBB`). One-time setup adds `source ~/.p10k.theme.zsh` to `.p10k.zsh`. `theme-set` symlinks that external file.  |
| **Neovim multi-theme** | Per-theme `neovim.lua` files. `theme-set` symlinks `~/.config/nvim/lua/plugins/theme.lua` → active theme. Base nvim config stays Stow-managed.                 |
| **Antigravity**        | Edit `workbench.colorTheme` in settings.json (no symlink option). Extensions installed via CLI.                                                                |
| **Obsidian**           | Constant folder name `Steez`. Single vault: `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Steve_Notes`. Symlink theme CSS.                          |
| **Safety**             | Backups to `~/.config/theme-backups/<timestamp>/` before changes, state persistence in `~/.config/current-theme`                                               |
| **Install flow**       | **MANDATORY**: Run `theme-set tokyo-night` after Stow completes to ensure configs exist                                                                        |
| **Out of scope**       | Aerospace (window manager, no themes), Raycast (paid feature), Helium (future)                                                                                 |

---

## Symlink Architecture (Omarchy-style)

All theme files use symlinks for atomic switching:

```
~/.config/sketchybar/colors.lua      → $DOTFILES/themes/configs/<theme>/sketchybar-colors.lua
~/.config/borders/bordersrc          → $DOTFILES/themes/configs/<theme>/bordersrc
~/.p10k.theme.zsh                    → $DOTFILES/themes/configs/<theme>/p10k-theme.zsh
~/.config/nvim/lua/plugins/theme.lua → $DOTFILES/themes/configs/<theme>/neovim.lua
```

**Benefits:**

- Atomic theme switching (single symlink update per file)
- No file duplication
- Easy to verify active theme (`ls -la` shows symlink target)

**Stow compatibility:**

- Use `stow --no-folding` to prevent directory symlinks
- Theme files NOT in Stow packages (managed by `theme-set`)
- Base configs remain Stow-managed

---

## Critical Requirements

1. **Tokyo Night COLORS are preserved exactly as-is**
   - Current color values in sketchybar, ghostty, borders, nvim remain unchanged
   - File structure CAN be modified for multi-theme support

2. **P10k gets themed for ALL themes** (including Tokyo Night)
   - Replace rainbow colors with theme-matching bubble colors
   - Use external source file approach (not sed/append on main file)

3. **Wallpaper uses exact same color as SketchyBar bar background** (`bg0`)

4. **Fork official theme CSS/configs from GitHub** - don't reinvent colors

5. **Zero external dependencies** - no jq, no npm, just bash + coreutils + Python3 (pre-installed on macOS)

---

## Color Format Reference

**Canonical format**: `#RRGGBB` (used in `themes/meta/*.env`)

| App         | Format Required   | Conversion from #RRGGBB                   |
| ----------- | ----------------- | ----------------------------------------- |
| SketchyBar  | `0xAARRGGBB`      | Prefix `0xff` + remove `#` → `0xff1a1b26` |
| Borders     | `0xAARRGGBB`      | Same as SketchyBar                        |
| Ghostty     | Theme name or hex | Use built-in theme names when available   |
| P10k        | `#RRGGBB`         | Direct (truecolor support)                |
| Neovim      | Plugin handles    | Just set colorscheme name                 |
| Antigravity | `#RRGGBB`         | Direct in JSON                            |
| Wallpaper   | PNG file          | Pre-generated solid color images          |

---

## Directory Structure

```
themes/
├── meta/                        # Theme metadata (env files)
│   ├── tokyo-night.env          # GHOSTTY_THEME, NVIM_COLORSCHEME, etc.
│   ├── gruvbox.env
│   └── everforest.env
├── palettes/                    # Central color definitions (Lua, for reference)
│   ├── tokyo-night.lua
│   ├── gruvbox.lua
│   └── everforest.lua
├── configs/                     # Per-theme app configs (COPIED, not symlinked)
│   ├── tokyo-night/
│   │   ├── sketchybar-colors.lua
│   │   ├── bordersrc
│   │   ├── p10k-theme.zsh
│   │   └── antigravity-colors.json
│   ├── gruvbox/
│   │   ├── sketchybar-colors.lua
│   │   ├── bordersrc
│   │   ├── p10k-theme.zsh
│   │   └── antigravity-colors.json
│   └── everforest/
│       ├── sketchybar-colors.lua
│       ├── bordersrc
│       ├── p10k-theme.zsh
│       └── antigravity-colors.json
├── obsidian/                    # Forked Obsidian themes (copied to Steez folder)
│   ├── tokyo-night/
│   │   ├── manifest.json
│   │   └── theme.css
│   ├── gruvbox/
│   │   ├── manifest.json
│   │   └── theme.css
│   └── everforest/
│       ├── manifest.json
│       └── theme.css
├── wallpapers/                  # Pre-generated solid color PNGs
│   ├── tokyo-night.png          # #1a1b26
│   ├── gruvbox.png              # #1d2021
│   └── everforest.png           # #2d353b
├── bin/
│   └── theme-set                # Main CLI script
└── README.md
```

---

## Stow Package Changes

**Files to REMOVE from Stow packages** (move to `themes/configs/tokyo-night/`):

| Current Location                           | New Location                                       | Reason         |
| ------------------------------------------ | -------------------------------------------------- | -------------- |
| `sketchybar/.config/sketchybar/colors.lua` | `themes/configs/tokyo-night/sketchybar-colors.lua` | Theme-variable |
| `borders/.config/borders/bordersrc`        | `themes/configs/tokyo-night/bordersrc`             | Theme-variable |

**Files that STAY in Stow packages** (not theme-variable):

- `sketchybar/.config/sketchybar/*.lua` (except colors.lua)
- `ghostty/.config/ghostty/config` (theme line updated in-place)
- `nvim/.config/nvim/lua/plugins/tokyonight.lua` (restructured for multi-theme)
- `zsh/.p10k.zsh` (one-time edit to add source line)

---

## App Coverage

| App             | Method                                | Auto-reload | Reload Command                      |
| --------------- | ------------------------------------- | ----------- | ----------------------------------- |
| **SketchyBar**  | Copy pre-made colors.lua              | Yes\*       | `sketchybar --reload`               |
| **Ghostty**     | Update theme line in config           | Yes         | Watches config file automatically   |
| **Borders**     | Copy pre-made bordersrc               | Yes\*       | `brew services restart borders`     |
| **Neovim**      | Update colorscheme in theme.lua       | No          | Restart nvim or `:colorscheme X`    |
| **P10k**        | Rewrite ~/.p10k.theme.zsh             | No          | `exec zsh` or restart terminal      |
| **Antigravity** | Update colorCustomizations via Python | Yes         | Watches settings.json automatically |
| **Obsidian**    | Copy CSS to Steez folder              | No          | Reload vault (Cmd+R) or restart app |
| **Wallpaper**   | osascript                             | Yes         | Instant                             |

\*`theme-set` script triggers reload automatically

---

## Theme Metadata Files

Each theme has a `.env` file for machine-readable metadata:

```bash
# themes/meta/tokyo-night.env
THEME_NAME="Tokyo Night"
GHOSTTY_THEME="TokyoNight"
NVIM_COLORSCHEME="tokyonight-night"
NVIM_PLUGIN="folke/tokyonight.nvim"
ANTIGRAVITY_THEME="Tokyo Night"
BG_COLOR="#1a1b26"
```

```bash
# themes/meta/gruvbox.env
THEME_NAME="Gruvbox Dark Hard"
GHOSTTY_THEME="GruvboxDarkHard"
NVIM_COLORSCHEME="gruvbox"
NVIM_PLUGIN="ellisonleao/gruvbox.nvim"
NVIM_SETUP="vim.o.background = 'dark'"
ANTIGRAVITY_THEME="Gruvbox Dark Hard"
BG_COLOR="#1d2021"
```

```bash
# themes/meta/everforest.env
THEME_NAME="Everforest Dark Medium"
GHOSTTY_THEME="Everforest Dark Medium"
NVIM_COLORSCHEME="everforest"
NVIM_PLUGIN="sainnhe/everforest"
NVIM_SETUP="vim.g.everforest_background = 'medium'"
ANTIGRAVITY_THEME="Everforest Dark Medium"
BG_COLOR="#2d353b"
```

---

## Official Color Sources

### Tokyo Night (Night variant)

- **Canonical**: [folke/tokyonight.nvim](https://github.com/folke/tokyonight.nvim)
- **Reference**: `extras/lua/tokyonight_night.lua`

| Color        | Hex       | Usage                     |
| ------------ | --------- | ------------------------- |
| bg           | `#1a1b26` | Background, wallpaper     |
| bg_highlight | `#292e42` | Current line              |
| fg           | `#c0caf5` | Main text                 |
| red          | `#f7768e` | Errors                    |
| orange       | `#ff9e64` | Numbers                   |
| yellow       | `#e0af68` | Warnings                  |
| green        | `#9ece6a` | Strings                   |
| teal         | `#73daca` | Object keys               |
| cyan         | `#7dcfff` | Properties                |
| blue         | `#7aa2f7` | Functions, primary accent |
| magenta      | `#bb9af7` | Keywords                  |
| comment      | `#565f89` | Comments                  |
| black        | `#414868` | Terminal black            |

### Gruvbox (Dark Hard variant)

- **Canonical**: [morhetz/gruvbox](https://github.com/morhetz/gruvbox)

| Color        | Hex       | Usage                   |
| ------------ | --------- | ----------------------- |
| bg           | `#1d2021` | Background (dark0_hard) |
| bg_highlight | `#3c3836` | Current line (dark1)    |
| fg           | `#ebdbb2` | Main text (light1)      |
| red          | `#fb4934` | bright_red              |
| orange       | `#fe8019` | bright_orange           |
| yellow       | `#fabd2f` | bright_yellow           |
| green        | `#b8bb26` | bright_green            |
| aqua         | `#8ec07c` | bright_aqua             |
| blue         | `#83a598` | bright_blue             |
| purple       | `#d3869b` | bright_purple           |
| gray         | `#928374` | Comments                |
| black        | `#282828` | dark0                   |

### Everforest (Dark Medium variant)

- **Canonical**: [sainnhe/everforest](https://github.com/sainnhe/everforest)

| Color        | Hex       | Usage              |
| ------------ | --------- | ------------------ |
| bg           | `#2d353b` | Background (bg0)   |
| bg_dim       | `#232a2e` | Darker background  |
| bg_highlight | `#3d484d` | Current line (bg2) |
| fg           | `#d3c6aa` | Main text          |
| red          | `#e67e80` |                    |
| orange       | `#e69875` |                    |
| yellow       | `#dbbc7f` |                    |
| green        | `#a7c080` | Primary accent     |
| aqua         | `#83c092` |                    |
| blue         | `#7fbbb3` |                    |
| purple       | `#d699b6` |                    |
| gray         | `#859289` | Comments (grey1)   |
| black        | `#4f585e` | bg4                |

---

## Antigravity Theming Approach

Antigravity (Google's VS Code fork) supports `workbench.colorCustomizations` in settings.json.

**Strategy**: Extract colors from official VS Code theme repos, store as JSON, merge into settings.json via Python.

### Theme Sources (VS Code repos)

| Theme       | Repository                                                                          | File                                  |
| ----------- | ----------------------------------------------------------------------------------- | ------------------------------------- |
| Tokyo Night | [enkia/tokyo-night-vscode-theme](https://github.com/enkia/tokyo-night-vscode-theme) | `themes/tokyo-night-color-theme.json` |
| Gruvbox     | [jdinhlife/vscode-theme-gruvbox](https://github.com/jdinhlife/vscode-theme-gruvbox) | `themes/gruvbox-dark-hard.json`       |
| Everforest  | [sainnhe/everforest-vscode](https://github.com/sainnhe/everforest-vscode)           | `themes/everforest-dark.json`         |

### Per-theme file (`themes/configs/<theme>/antigravity-colors.json`)

```json
{
  "colors": {
    "editor.background": "#1a1b26",
    "editor.foreground": "#c0caf5",
    "activityBar.background": "#1a1b26",
    "sideBar.background": "#1a1b26",
    "statusBar.background": "#1a1b26",
    ...
  },
  "tokenColors": [
    {
      "scope": ["comment"],
      "settings": { "foreground": "#565f89" }
    },
    ...
  ]
}
```

### Settings.json update (via Python)

```python
# In theme-set script
python3 << 'EOF'
import json
settings_file = "$ANTIGRAVITY_SETTINGS"
colors_file = "$THEMES_DIR/configs/$THEME/antigravity-colors.json"

with open(settings_file, 'r') as f:
    settings = json.load(f)
with open(colors_file, 'r') as f:
    colors = json.load(f)

settings['workbench.colorCustomizations'] = colors.get('colors', {})
settings['editor.tokenColorCustomizations'] = {'textMateRules': colors.get('tokenColors', [])}

with open(settings_file, 'w') as f:
    json.dump(settings, f, indent=2)
EOF
```

### Settings.json location

```
~/Library/Application Support/Antigravity/User/settings.json
```

---

## P10k Theming Approach

**Strategy**: External source file using **truecolor** (`#RRGGBB`) for accurate theme colors.

### One-time setup (added to end of `.p10k.zsh`):

```zsh
# Theme colors - managed by theme-set
[[ -r ~/.p10k.theme.zsh ]] && source ~/.p10k.theme.zsh
```

### Per-theme file (`~/.p10k.theme.zsh`) - Tokyo Night example:

```zsh
# STEEZ THEME: tokyo-night
# Auto-generated by theme-set - do not edit manually

# Override rainbow colors with truecolor theme colors
typeset -g POWERLEVEL9K_OS_ICON_FOREGROUND='#1a1b26'
typeset -g POWERLEVEL9K_OS_ICON_BACKGROUND='#7aa2f7'      # blue

typeset -g POWERLEVEL9K_DIR_FOREGROUND='#1a1b26'
typeset -g POWERLEVEL9K_DIR_BACKGROUND='#7aa2f7'          # blue

typeset -g POWERLEVEL9K_VCS_CLEAN_FOREGROUND='#1a1b26'
typeset -g POWERLEVEL9K_VCS_CLEAN_BACKGROUND='#9ece6a'    # green
typeset -g POWERLEVEL9K_VCS_MODIFIED_FOREGROUND='#1a1b26'
typeset -g POWERLEVEL9K_VCS_MODIFIED_BACKGROUND='#e0af68' # yellow
typeset -g POWERLEVEL9K_VCS_UNTRACKED_FOREGROUND='#1a1b26'
typeset -g POWERLEVEL9K_VCS_UNTRACKED_BACKGROUND='#e0af68'

typeset -g POWERLEVEL9K_STATUS_OK_FOREGROUND='#1a1b26'
typeset -g POWERLEVEL9K_STATUS_OK_BACKGROUND='#9ece6a'    # green
typeset -g POWERLEVEL9K_STATUS_ERROR_FOREGROUND='#1a1b26'
typeset -g POWERLEVEL9K_STATUS_ERROR_BACKGROUND='#f7768e' # red

typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_FOREGROUND='#1a1b26'
typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_BACKGROUND='#e0af68'
```

---

## theme-set Script Logic

```bash
#!/usr/bin/env bash
# themes/bin/theme-set

set -euo pipefail

THEME="${1:-}"
DOTFILES="${DOTFILES:-$HOME/Projects/Personal/dotfiles}"
THEMES_DIR="$DOTFILES/themes"
STATE_FILE="$HOME/.config/current-theme"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

usage() {
    echo "Usage: theme-set <theme>"
    echo ""
    echo "Available themes:"
    for d in "$THEMES_DIR/configs"/*/; do
        echo "  - $(basename "$d")"
    done
    exit 1
}

log() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

backup_file() {
    local file="$1"
    if [[ -f "$file" ]]; then
        cp "$file" "${file}.backup.$(date +%Y%m%d_%H%M%S)"
    fi
}

# Validate
[[ -z "$THEME" ]] && usage
[[ ! -d "$THEMES_DIR/configs/$THEME" ]] && error "Unknown theme: $THEME"

# Load theme metadata
source "$THEMES_DIR/meta/$THEME.env"

echo "Setting theme: $THEME_NAME"
echo ""

# 1. SketchyBar
if [[ -f "$THEMES_DIR/configs/$THEME/sketchybar-colors.lua" ]]; then
    backup_file ~/.config/sketchybar/colors.lua
    cp "$THEMES_DIR/configs/$THEME/sketchybar-colors.lua" ~/.config/sketchybar/colors.lua
    sketchybar --reload 2>/dev/null && log "SketchyBar" || warn "SketchyBar (not running)"
fi

# 2. Ghostty
if [[ -f ~/.config/ghostty/config ]]; then
    backup_file ~/.config/ghostty/config
    sed -i '' "s/^theme = .*/theme = $GHOSTTY_THEME/" ~/.config/ghostty/config
    log "Ghostty"
fi

# 3. Borders
if [[ -f "$THEMES_DIR/configs/$THEME/bordersrc" ]]; then
    backup_file ~/.config/borders/bordersrc
    cp "$THEMES_DIR/configs/$THEME/bordersrc" ~/.config/borders/bordersrc
    brew services restart borders 2>/dev/null && log "Borders" || warn "Borders (not running)"
fi

# 4. P10k (external file approach)
if [[ -f "$THEMES_DIR/configs/$THEME/p10k-theme.zsh" ]]; then
    cp "$THEMES_DIR/configs/$THEME/p10k-theme.zsh" ~/.p10k.theme.zsh
    log "P10k theme file"
fi

# 5. Neovim (update theme file)
if [[ -f ~/.config/nvim/lua/config/theme.lua ]]; then
    echo "return '$NVIM_COLORSCHEME'" > ~/.config/nvim/lua/config/current-theme.lua
    log "Neovim theme"
fi

# 6. Antigravity (update colorCustomizations via Python)
ANTIGRAVITY_SETTINGS="$HOME/Library/Application Support/Antigravity/User/settings.json"
if [[ -f "$ANTIGRAVITY_SETTINGS" && -f "$THEMES_DIR/configs/$THEME/antigravity-colors.json" ]]; then
    backup_file "$ANTIGRAVITY_SETTINGS"
    python3 << EOF
import json
with open('$ANTIGRAVITY_SETTINGS', 'r') as f:
    settings = json.load(f)
with open('$THEMES_DIR/configs/$THEME/antigravity-colors.json', 'r') as f:
    colors = json.load(f)
settings['workbench.colorCustomizations'] = colors.get('colors', {})
settings['editor.tokenColorCustomizations'] = {'textMateRules': colors.get('tokenColors', [])}
with open('$ANTIGRAVITY_SETTINGS', 'w') as f:
    json.dump(settings, f, indent=2)
EOF
    log "Antigravity"
fi

# 7. Obsidian (copy to Steez folder)
OBSIDIAN_VAULT="$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Steve_Notes"
if [[ -d "$OBSIDIAN_VAULT/.obsidian" ]]; then
    mkdir -p "$OBSIDIAN_VAULT/.obsidian/themes/Steez"
    cp "$THEMES_DIR/obsidian/$THEME/"* "$OBSIDIAN_VAULT/.obsidian/themes/Steez/" 2>/dev/null || true
    log "Obsidian vault: Steve_Notes"
fi

# 8. Wallpaper
if [[ -f "$THEMES_DIR/wallpapers/$THEME.png" ]]; then
    osascript -e "tell application \"System Events\" to tell every desktop to set picture to POSIX file \"$THEMES_DIR/wallpapers/$THEME.png\""
    log "Wallpaper"
fi

# Save state
mkdir -p "$(dirname "$STATE_FILE")"
echo "$THEME" > "$STATE_FILE"

echo ""
echo "Theme set to: $THEME_NAME"
echo ""
echo "Manual steps (if needed):"
echo "  - Neovim: restart or run :colorscheme $NVIM_COLORSCHEME"
echo "  - Zsh: run 'p10k reload' or restart terminal"
echo "  - Obsidian: reload vault if theme doesn't update"
```

---

## Implementation Phases

### Phase 0: Safety & Structure Setup

**Pre-phase**: No additional context needed

1. Create `themes/` directory structure
2. Create theme metadata files (`themes/meta/*.env`)
3. Verify Ghostty theme names exist (`ghostty +list-themes`)

### Phase 1: Tokyo Night Baseline

**Pre-phase**: Ask user about any custom modifications to current configs

1. Move current `sketchybar/colors.lua` to `themes/configs/tokyo-night/sketchybar-colors.lua`
2. Move current `borders/bordersrc` to `themes/configs/tokyo-night/bordersrc`
3. Create Tokyo Night palette file (reference only)
4. Update `install.sh` to copy default theme configs
5. Remove theme files from Stow packages

### Phase 2: P10k Theming

**Pre-phase**: Ask about any p10k customizations beyond colors

1. Create Tokyo Night `p10k-theme.zsh`
2. Add one-time source line to `.p10k.zsh`
3. Create Gruvbox and Everforest `p10k-theme.zsh`

### Phase 3: Gruvbox & Everforest Configs

**Pre-phase**: Confirm color mapping preferences

1. Create `sketchybar-colors.lua` for Gruvbox
2. Create `sketchybar-colors.lua` for Everforest
3. Create `bordersrc` for Gruvbox
4. Create `bordersrc` for Everforest

### Phase 4: Antigravity Theming

**Pre-phase**: Confirm Antigravity settings.json location, review current settings

1. Download official theme JSON files from GitHub repos
2. Extract and format colors into `antigravity-colors.json` for each theme
3. Test color application in Antigravity

### Phase 5: Neovim Multi-Theme (Omarchy-style Symlinks)

**Approach**: Symlink-based theme switching (inspired by Omarchy), compatible with Stow.

**Key decision**: Don't use loader approach. Use per-theme `neovim.lua` files with symlink switching.

1. Remove `tokyonight.lua` from nvim Stow package
2. Delete `example.lua` (unused boilerplate)
3. Create per-theme neovim.lua files in `themes/configs/<theme>/neovim.lua`
4. Update `theme-set` to create symlink: `~/.config/nvim/lua/plugins/theme.lua` → active theme
5. Add Stow folding guard to `theme-set`
6. Update `install.sh` to use `stow --no-folding nvim`

**Per-theme neovim.lua structure** (e.g., `themes/configs/tokyo-night/neovim.lua`):

```lua
return {
  { "folke/tokyonight.nvim", lazy = false, priority = 1000 },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "tokyonight-night",
    },
  },
}
```

**Stow compatibility**:

- Base nvim config remains Stow-managed
- `theme.lua` is NOT in Stow package (created by theme-set)
- Use `stow --no-folding nvim` to prevent directory symlinks
- If user runs `stow nvim` without theme-set, nvim boots with LazyVim defaults

**theme-set symlink logic**:

```bash
# Guard against Stow folding
if [[ -L "$HOME/.config/nvim/lua/plugins" ]]; then
  error "plugins/ is a symlink. Run: stow --no-folding --restow nvim"
  exit 1
fi

# Create/update theme symlink
ln -sfn "$THEMES_DIR/configs/$THEME/neovim.lua" "$HOME/.config/nvim/lua/plugins/theme.lua"
```

### Phase 6: Obsidian Themes

**Pre-phase**: Ask about custom CSS modifications in Obsidian vaults

1. Fork Tokyo Night theme CSS from GitHub
2. Fork Gruvbox theme CSS from GitHub
3. Fork Everforest theme CSS from GitHub
4. Create manifest.json files with proper attribution
5. Create `themes/obsidian/SOURCES.md` with repo URLs and commits used
6. Document how to set Obsidian to use "Steez" theme

**Obsidian Theme Sources**:
| Theme | Repository |
| ----------- | ------------------------------------------------------------------------------------ |
| Tokyo Night | [tcmmichaelb139/obsidian-tokyonight](https://github.com/tcmmichaelb139/obsidian-tokyonight) |
| Gruvbox | [insanum/obsidian_gruvbox](https://github.com/insanum/obsidian_gruvbox) |
| Everforest | [0xGlitchbyte/obsidian_everforest](https://github.com/0xGlitchbyte/obsidian_everforest) |

### Phase 7: Wallpapers & Script

**Pre-phase**: Confirm wallpaper approach (solid color PNGs)

1. Generate solid color PNG wallpapers
2. Create `theme-set` script
3. Test full switching flow

### Phase 8: Install.sh Integration & Docs

**Pre-phase**: None

1. Add theme config copying to `install.sh`
2. Create `themes/README.md`
3. Update main README with theme instructions

---

## Files to Create

| File                                                 | Description                       |
| ---------------------------------------------------- | --------------------------------- |
| `themes/meta/tokyo-night.env`                        | Tokyo Night metadata              |
| `themes/meta/gruvbox.env`                            | Gruvbox metadata                  |
| `themes/meta/everforest.env`                         | Everforest metadata               |
| `themes/palettes/tokyo-night.lua`                    | Tokyo Night colors (reference)    |
| `themes/palettes/gruvbox.lua`                        | Gruvbox colors (reference)        |
| `themes/palettes/everforest.lua`                     | Everforest colors (reference)     |
| `themes/configs/tokyo-night/sketchybar-colors.lua`   | Moved from sketchybar/            |
| `themes/configs/tokyo-night/bordersrc`               | Moved from borders/               |
| `themes/configs/tokyo-night/p10k-theme.zsh`          | Truecolor P10k overrides          |
| `themes/configs/tokyo-night/antigravity-colors.json` | Extracted from VS Code theme repo |
| `themes/configs/gruvbox/sketchybar-colors.lua`       | Generated                         |
| `themes/configs/gruvbox/bordersrc`                   | Generated                         |
| `themes/configs/gruvbox/p10k-theme.zsh`              | Truecolor P10k overrides          |
| `themes/configs/gruvbox/antigravity-colors.json`     | Extracted from VS Code theme repo |
| `themes/configs/everforest/sketchybar-colors.lua`    | Generated                         |
| `themes/configs/everforest/bordersrc`                | Generated                         |
| `themes/configs/everforest/p10k-theme.zsh`           | Truecolor P10k overrides          |
| `themes/configs/everforest/antigravity-colors.json`  | Extracted from VS Code theme repo |
| `themes/obsidian/SOURCES.md`                         | Attribution and source URLs       |
| `themes/obsidian/*/theme.css`                        | Forked from GitHub                |
| `themes/obsidian/*/manifest.json`                    | Created with attribution          |
| `themes/wallpapers/*.png`                            | Generated solid colors            |
| `themes/bin/theme-set`                               | Main CLI script                   |
| `themes/README.md`                                   | Usage documentation               |
| `nvim/.config/nvim/lua/plugins/colorschemes.lua`     | Multi-theme plugin spec           |
| `nvim/.config/nvim/lua/config/theme.lua`             | Theme loader with fallback        |

---

## Files to Modify

| File                                           | Change                                             |
| ---------------------------------------------- | -------------------------------------------------- |
| `sketchybar/.config/sketchybar/colors.lua`     | DELETE (moved to themes/)                          |
| `borders/.config/borders/bordersrc`            | DELETE (moved to themes/)                          |
| `nvim/.config/nvim/lua/plugins/tokyonight.lua` | RENAME → `colorschemes.lua`, add all theme plugins |
| `nvim/.config/nvim/lua/config/` (new)          | Add `theme.lua` loader and `current-theme.lua`     |
| `zsh/.p10k.zsh`                                | Add source line for theme file at end              |
| `installer/install.sh`                         | Add `theme-set tokyo-night` after Stow completes   |

---

## Out of Scope

| App       | Reason                                       |
| --------- | -------------------------------------------- |
| Aerospace | Window manager - no theming capability       |
| Raycast   | Theme customization requires paid plan       |
| Helium    | Chrome theme approach - future consideration |
| Karabiner | No visual theming                            |
| AutoRaise | No visual theming                            |
