# THEME SYSTEM AGENTS

## OVERVIEW

Symlink-based cross-app theme switcher using `theme-set` CLI and `.env` metadata. Supports 9 apps with automatic or manual reload.

## COMMANDS

```bash
# Show current theme and available options
theme-set

# Switch to specific theme
theme-set tokyo-night
theme-set gruvbox
theme-set everforest

# Cycle through themes
theme-set --next    # or -n
theme-set --prev    # or -p

# Check current theme
cat ~/.config/current-theme

# Verify symlinks
ls -la ~/.config/sketchybar/colors.lua
ls -la ~/.config/nvim/lua/plugins/theme.lua
```

## RAYCAST INTEGRATION

The **Theme Switcher** Raycast extension provides visual theme selection:

- Grid view with SVG-generated color stripe previews
- Calls `~/.local/bin/theme-set <theme-id>` under the hood
- **Data-driven**: Reads themes dynamically from `themes/themes.json`
- **No code changes needed** when adding themes — just update `themes.json`

### How It Works

```
themes/themes.json  -->  src/themes.ts (loadThemes())  -->  UI components
                                                                  |
                                                                  v
                                                      ~/.local/bin/theme-set
```

The extension uses `loadThemes()` which parses `themes.json` at runtime, so new themes appear automatically after adding them to the JSON file.

## WHERE TO LOOK

| Task             | Location                                |
| ---------------- | --------------------------------------- |
| CLI Logic        | `.local/bin/theme-set`                  |
| Theme Metadata   | `meta/<theme>.env`                      |
| App Configs      | `configs/<theme>/`                      |
| Color Palettes   | `palettes/<theme>.lua` (reference only) |
| Wallpapers       | `wallpapers/<theme>.png`                |
| Wallpaper Script | `scripts/generate-wallpaper.py`         |
| Raycast Data     | `themes.json`                           |
| State File       | `~/.config/current-theme`               |
| Backups          | `~/.config/theme-backups/`              |

## SUPPORTED APPS (9 total)

| App         | Config Method            | Reload               | Manual Action |
| ----------- | ------------------------ | -------------------- | ------------- |
| SketchyBar  | Symlink `colors.lua`     | Auto (`--reload`)    | None          |
| Ghostty     | Symlink `theme.conf`     | Auto (SIGUSR2)       | None          |
| Borders     | Symlink `bordersrc`      | Auto (script exec)   | None          |
| P10k        | Symlink `p10k.theme.zsh` | Auto (prompt redraw) | Press Enter   |
| Wallpaper   | osascript                | Auto                 | None          |
| Antigravity | JSON edit                | Auto (watched)       | None          |
| Obsidian    | JSON edit + CSS copy     | Auto (watched)       | None          |
| Neovim      | Symlink `theme.lua`      | **Manual**           | Quit & reopen |
| OpenCode    | JSON edit                | **Manual**           | Restart       |

---

## ADDING A NEW THEME — COMPLETE CHECKLIST

### Prerequisites

- [ ] Choose a theme with existing support in: Neovim, Ghostty, Obsidian, Antigravity (VS Code themes work)
- [ ] Gather the canonical color palette (bg, fg, accents)
- [ ] Note app-specific theme identifiers

### Step 1: Create Metadata File

Create `themes/meta/<theme-name>.env`:

```bash
# <Theme Name> Theme Metadata
# Canonical source: <URL to theme repo>

THEME_NAME="Display Name"
THEME_VARIANT="variant"  # e.g., "night", "dark-hard", "dark-medium"

# App-specific theme identifiers
GHOSTTY_THEME="ThemeName"           # Must exist in Ghostty themes
NVIM_COLORSCHEME="colorscheme-name" # Exact vim colorscheme name
NVIM_PLUGIN="author/plugin.nvim"    # Plugin that provides colorscheme
ANTIGRAVITY_THEME="VS Code Theme"   # Exact VS Code theme name
OPENCODE_THEME="opencode-theme"     # OpenCode theme identifier
OBSIDIAN_THEME="Obsidian Theme"     # Obsidian community theme name

# Core palette (canonical #RRGGBB format)
BG_COLOR="#rrggbb"       # Primary background
BG_HIGHLIGHT="#rrggbb"   # Selection/highlight
FG_COLOR="#rrggbb"       # Primary foreground
RED="#rrggbb"
ORANGE="#rrggbb"
YELLOW="#rrggbb"
GREEN="#rrggbb"
CYAN="#rrggbb"
BLUE="#rrggbb"
MAGENTA="#rrggbb"
COMMENT="#rrggbb"        # Muted/grey color
BLACK="#rrggbb"          # Dark accent
```

### Step 2: Create Config Files

Create directory `themes/configs/<theme-name>/` with these 6 files:

#### 2.1 SketchyBar Colors (`sketchybar-colors.lua`)

```lua
local colors = {
  black = 0xffRRGGBB,      -- Note: 0xffRRGGBB format (ff = alpha)
  white = 0xffRRGGBB,
  red = 0xffRRGGBB,
  green = 0xffRRGGBB,
  blue = 0xffRRGGBB,
  yellow = 0xffRRGGBB,
  orange = 0xffRRGGBB,
  magenta = 0xffRRGGBB,
  grey = 0xffRRGGBB,
  transparent = 0x00000000,
  highlight = 0x33RRGGBB,  -- 33 = 20% alpha for highlight
  bg0 = 0xffRRGGBB,        -- Primary background
  bg1 = 0xffRRGGBB,        -- Secondary background
  bg2 = 0xffRRGGBB,        -- Tertiary background
}

colors.bar = {
  bg = colors.bg0,
  border = 0xffRRGGBB,     -- Bar border accent color
}

colors.popup = {
  bg = colors.bg0,
  border = 0xffRRGGBB,     -- Popup border accent color
}

return colors
```

#### 2.2 Ghostty Theme (`ghostty.conf`)

```conf
# Theme: <Theme Name>
theme = <GHOSTTY_THEME value from .env>
```

> **Note**: Ghostty theme must exist in Ghostty's built-in themes or `~/.config/ghostty/themes/`

#### 2.3 Borders Config (`bordersrc`)

```bash
#!/usr/bin/env bash
options=(
  style=round
  width=5.0
  hidpi=off
  active_color=0xffRRGGBB   # Foreground or accent color
  inactive_color=0xb3RRGGBB # Background with ~70% alpha (b3)
  ax_focus=off
)
borders "${options[@]}"
```

#### 2.4 Neovim Theme (`neovim.lua`)

```lua
-- <Theme Name> theme for Neovim (LazyVim)
-- Managed by theme-set, symlinked to ~/.config/nvim/lua/plugins/theme.lua
return {
  { "<NVIM_PLUGIN>", lazy = false, priority = 1000 },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "<NVIM_COLORSCHEME>",
    },
  },
}
```

#### 2.5 P10k Theme (`p10k-theme.zsh`)

```zsh
# Powerlevel10k theme overrides for <Theme Name>
# Sourced by ~/.p10k.zsh

typeset -g POWERLEVEL9K_OS_ICON_FOREGROUND=<color_index>
typeset -g POWERLEVEL9K_DIR_FOREGROUND=<color_index>
typeset -g POWERLEVEL9K_VCS_CLEAN_FOREGROUND=<color_index>
# ... (copy from existing theme and adjust color indices)
```

> **Tip**: Copy from an existing theme's `p10k-theme.zsh` and adjust P10k color indices (0-255)

#### 2.6 Obsidian Snippet (`obsidian-snippet.css`)

```css
/* <Theme Name> - Active explorer file styling */
.nav-file.is-active > .nav-file-title {
  background-color: #RRGGBB !important; /* bg_highlight */
  color: #RRGGBB !important; /* accent color */
}

.nav-folder.is-active > .nav-folder-title {
  color: #RRGGBB !important; /* accent color */
}

/* Additional styling as needed */
```

### Step 3: Create Wallpaper

Generate wallpaper using the included script:

```bash
cd ~/dotfiles/themes
python3 scripts/generate-wallpaper.py "#RRGGBB" <theme-name>.png
```

Example:

```bash
python3 scripts/generate-wallpaper.py "#1a1b26" tokyo-night.png
```

- Uses `BG_COLOR` from your `.env` file
- Generates 5120x2880 (5K) PNG for Retina displays
- Pure Python, no external dependencies required

### Step 4: Update themes.json (for Raycast Extension)

The Raycast extension reads themes dynamically from `themes/themes.json`. **No extension code changes needed** — just add your theme entry.

Add entry to `themes/themes.json` in the `"themes"` array:

```json
{
  "id": "<theme-name>",
  "name": "Display Name",
  "colors": {
    "bg0": "#rrggbb",
    "bg1": "#rrggbb",
    "bg2": "#rrggbb",
    "fg": "#rrggbb",
    "grey": "#rrggbb",
    "red": "#rrggbb",
    "green": "#rrggbb",
    "yellow": "#rrggbb",
    "blue": "#rrggbb",
    "magenta": "#rrggbb",
    "cyan": "#rrggbb",
    "orange": "#rrggbb"
  }
}
```

> **Note**: The `id` must match the theme directory name (e.g., `tokyo-night` matches `configs/tokyo-night/`). Colors are used to generate the visual preview stripe in the Raycast UI.

### Step 5: Update theme-set Script

Edit `.local/bin/theme-set` line ~24:

```bash
# Theme cycle order
THEMES=(everforest gruvbox tokyo-night <new-theme>)
```

### Step 6: Create Palette Reference (Optional)

Create `themes/palettes/<theme-name>.lua`:

```lua
-- <Theme Name> color palette
-- FOR REFERENCE ONLY - not used at runtime

return {
  bg = "#rrggbb",
  fg = "#rrggbb",
  -- ... all colors
}
```

### Step 7: Verification Checklist

Run these checks:

```bash
# Test theme switching
theme-set <theme-name>

# Verify all symlinks created
ls -la ~/.config/sketchybar/colors.lua
ls -la ~/.config/ghostty/theme.conf
ls -la ~/.config/borders/bordersrc
ls -la ~/.p10k.theme.zsh
ls -la ~/.config/nvim/lua/plugins/theme.lua

# Check state file
cat ~/.config/current-theme

# Verify apps updated
# - SketchyBar: Check bar colors
# - Ghostty: Open new terminal
# - Borders: Check window borders
# - P10k: Press Enter in terminal
# - Neovim: Quit and reopen
# - Obsidian: Check sidebar styling
# - Wallpaper: Check desktop background
```

### Step 8: Test Raycast Extension

1. Open Raycast → "Switch Theme"
2. Verify new theme appears in grid
3. Select new theme, confirm it switches

---

## FILE REFERENCE

### Required Files Per Theme (8 total)

| File                    | Location           | Purpose                    |
| ----------------------- | ------------------ | -------------------------- |
| `<theme>.env`           | `meta/`            | Metadata + app identifiers |
| `sketchybar-colors.lua` | `configs/<theme>/` | SketchyBar colors          |
| `ghostty.conf`          | `configs/<theme>/` | Ghostty theme reference    |
| `bordersrc`             | `configs/<theme>/` | JankyBorders config        |
| `neovim.lua`            | `configs/<theme>/` | LazyVim colorscheme        |
| `p10k-theme.zsh`        | `configs/<theme>/` | Powerlevel10k overrides    |
| `obsidian-snippet.css`  | `configs/<theme>/` | Obsidian sidebar CSS       |
| `<theme>.png`           | `wallpapers/`      | Desktop wallpaper          |

### Optional Files

| File          | Location    | Purpose                     |
| ------------- | ----------- | --------------------------- |
| `<theme>.lua` | `palettes/` | Color reference (docs only) |

### System Files Modified

| App         | Target File                                                    |
| ----------- | -------------------------------------------------------------- |
| SketchyBar  | `~/.config/sketchybar/colors.lua`                              |
| Ghostty     | `~/.config/ghostty/theme.conf`                                 |
| Borders     | `~/.config/borders/bordersrc`                                  |
| P10k        | `~/.p10k.theme.zsh`                                            |
| Neovim      | `~/.config/nvim/lua/plugins/theme.lua`                         |
| Obsidian    | `<vault>/.obsidian/appearance.json` + `snippets/`              |
| Antigravity | `~/Library/Application Support/Antigravity/User/settings.json` |
| OpenCode    | `~/.config/opencode/opencode.json`                             |

---

## ANTI-PATTERNS

| Pattern                                      | Why Bad                       | Alternative                       |
| -------------------------------------------- | ----------------------------- | --------------------------------- |
| Direct edits to `~/.config/<app>/colors.lua` | Symlink, will be overwritten  | Edit in `themes/configs/<theme>/` |
| Adding theme colors to Stow packages         | Breaks theme switching        | Use theme system exclusively      |
| Incomplete themes (missing files)            | theme-set silently skips      | Include all 6 config files        |
| Editing palette files expecting changes      | Reference only, not loaded    | Edit config files directly        |
| `~/.config/nvim/lua/plugins` as symlink      | Stow folding breaks theme.lua | Use `stow --no-folding nvim`      |

## TROUBLESHOOTING

```bash
# "plugins/ is a symlink" error
cd ~/dotfiles && stow -D nvim && stow --no-folding nvim

# Theme not applied after install
theme-set tokyo-night

# Check current theme
cat ~/.config/current-theme

# Verify symlinks point to correct theme
ls -la ~/.config/sketchybar/colors.lua

# Force SketchyBar reload
sketchybar --reload

# Force Ghostty reload
killall -SIGUSR2 ghostty
```
