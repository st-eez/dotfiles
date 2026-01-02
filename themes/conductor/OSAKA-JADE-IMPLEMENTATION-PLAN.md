# Osaka Jade Theme Implementation Plan

**Created:** 2026-01-01
**Updated:** 2026-01-01
**Status:** ✅ COMPLETED (Phase 1) - Custom themes for Neovim/OpenCode pending
**Source:** [basecamp/omarchy](https://github.com/basecamp/omarchy/tree/master/themes/osaka-jade) (Official)

---

## Executive Summary

This document provides a complete, step-by-step implementation plan for adding the "Osaka Jade" theme to the dotfiles theme system. It also serves as a reusable template for adding future themes.

**Theme Overview:**

- **Name:** Osaka Jade
- **ID:** `osaka-jade`
- **Source:** [basecamp/omarchy](https://github.com/basecamp/omarchy/tree/master/themes/osaka-jade) (Official Omarchy repo)
- **Neovim Plugin:** `ribru17/bamboo.nvim` (colorscheme: `bamboo`) ⚠️ User prefers custom theme
- **Primary Accent:** Jade green (`#71CEAD` for borders, `#549e6a` for terminal)
- **Background:** Deep dark green (`#111c18`)

---

## Implementation Strategy

### Files to COPY from Omarchy (4 items)

| Source (Omarchy)       | Target                                | Modifications                          |
| ---------------------- | ------------------------------------- | -------------------------------------- |
| `ghostty.conf` palette | `~/.config/ghostty/themes/osaka-jade` | Format as Ghostty custom theme file    |
| `neovim.lua`           | `configs/osaka-jade/neovim.lua`       | Add `lazy = false`, add header comment |
| `vscode.json`          | (info only)                           | Extract `ANTIGRAVITY_THEME` for `.env` |
| `backgrounds/*`        | `wallpapers/osaka-jade/`              | Rename to `N-name.ext` pattern         |

### Files to CREATE (6 items)

| File                                       | Purpose                    | Derive From                    |
| ------------------------------------------ | -------------------------- | ------------------------------ |
| `meta/osaka-jade.env`                      | Metadata + app identifiers | Omarchy sources                |
| `configs/osaka-jade/ghostty.conf`          | Theme reference            | Just `theme = osaka-jade`      |
| `configs/osaka-jade/sketchybar-colors.lua` | SketchyBar colors          | Ghostty palette                |
| `configs/osaka-jade/bordersrc`             | Window borders             | Ghostty palette                |
| `configs/osaka-jade/obsidian-snippet.css`  | Obsidian sidebar           | Ghostty palette                |
| `~/.config/ghostty/themes/osaka-jade`      | Custom Ghostty theme       | Copy from Omarchy ghostty.conf |

### Files to MODIFY (2 items)

| File                   | Change                                     |
| ---------------------- | ------------------------------------------ |
| `themes.json`          | Add osaka-jade entry for Raycast           |
| `.local/bin/theme-set` | Add `osaka-jade` to THEMES array (line 30) |

---

## Validated Color Palette (Official Omarchy Source)

From: `https://github.com/basecamp/omarchy/blob/master/themes/osaka-jade/ghostty.conf`

### Primary Colors

```
background:    #111c18
foreground:    #C1C497
cursor-color:  #D7C995
cursor-text:   #000000
```

### ANSI Normal (0-7)

```
0 black:       #23372B
1 red:         #FF5345
2 green:       #549e6a
3 yellow:      #459451  ← Intentionally jade (theme design)
4 blue:        #509475  ← Intentionally jade (theme design)
5 magenta:     #D2689C
6 cyan:        #2DD5B7
7 white:       #F6F5DD
```

### ANSI Bright (8-15)

```
8 black:       #53685B
9 red:         #db9f9c
10 green:      #63b07a
11 yellow:     #E5C736  ← Actual yellow
12 blue:       #ACD4CF
13 magenta:    #75bbb3
14 cyan:       #8CD3CB
15 white:      #9eebb3
```

### Accent Color (from hyprland.conf)

```
activeBorderColor: #71CEAD  ← Signature jade accent
```

### Derived Colors for Our Configs

```
bg0:           #111c18  (primary background)
bg1:           #1a2520  (derived intermediate)
bg2:           #23372B  (highlight/selection)
grey/comment:  #53685B  (bright black)
orange:        #E5C736  (using bright yellow)
```

---

## App-Specific Identifiers (Verified from Omarchy)

| App             | Identifier                                           | Source                     |
| --------------- | ---------------------------------------------------- | -------------------------- |
| **Ghostty**     | `osaka-jade` (custom theme)                          | We create this             |
| **Neovim**      | Plugin: `ribru17/bamboo.nvim`, Colorscheme: `bamboo` | Omarchy neovim.lua         |
| **Antigravity** | `Ocean Green: Dark`                                  | Omarchy vscode.json        |
| **Obsidian**    | `Osaka Jade`                                         | Community theme by sspaeti |
| **OpenCode**    | `everforest` (fallback)                              | No native support          |

---

## Step-by-Step Implementation

### Phase 1: Create Directory Structure

```bash
# Step 1.1: Create configs directory
mkdir -p ~/Projects/Personal/dotfiles/themes/configs/osaka-jade

# Step 1.2: Create wallpapers directory
mkdir -p ~/Projects/Personal/dotfiles/themes/wallpapers/osaka-jade

# Step 1.3: Ensure Ghostty themes directory exists
mkdir -p ~/.config/ghostty/themes
```

---

### Phase 2: Create Custom Ghostty Theme (REQUIRED FIRST)

This must be created BEFORE running `theme-set osaka-jade`.

**File:** `~/.config/ghostty/themes/osaka-jade`

**Source:** Copy palette from Omarchy's ghostty.conf, format as Ghostty theme

```
# Osaka Jade
# Custom Ghostty theme from Omarchy
# Source: https://github.com/basecamp/omarchy/tree/master/themes/osaka-jade

background = 111c18
foreground = C1C497
cursor-color = D7C995
cursor-text = 000000
selection-background = 23372B
selection-foreground = C1C497

# Normal colors (palette 0-7)
palette = 0=#23372B
palette = 1=#FF5345
palette = 2=#549e6a
palette = 3=#459451
palette = 4=#509475
palette = 5=#D2689C
palette = 6=#2DD5B7
palette = 7=#F6F5DD

# Bright colors (palette 8-15)
palette = 8=#53685B
palette = 9=#db9f9c
palette = 10=#63b07a
palette = 11=#E5C736
palette = 12=#ACD4CF
palette = 13=#75bbb3
palette = 14=#8CD3CB
palette = 15=#9eebb3
```

---

### Phase 3: Create Metadata File

**File:** `themes/meta/osaka-jade.env`

```bash
# Osaka Jade Theme Metadata
# Canonical source: https://github.com/basecamp/omarchy/tree/master/themes/osaka-jade

THEME_NAME="Osaka Jade"
THEME_VARIANT="dark"

# App-specific theme identifiers
GHOSTTY_THEME="osaka-jade"
NVIM_COLORSCHEME="bamboo"
NVIM_PLUGIN="ribru17/bamboo.nvim"
ANTIGRAVITY_THEME="Ocean Green: Dark"
OPENCODE_THEME="everforest"
OBSIDIAN_THEME="Osaka Jade"

# Core palette (canonical #RRGGBB format) - for reference
BG_COLOR="#111c18"
BG_HIGHLIGHT="#23372B"
FG_COLOR="#C1C497"
RED="#FF5345"
ORANGE="#E5C736"
YELLOW="#E5C736"
GREEN="#549e6a"
AQUA="#2DD5B7"
CYAN="#2DD5B7"
BLUE="#509475"
MAGENTA="#D2689C"
COMMENT="#53685B"
BLACK="#23372B"
```

---

### Phase 4: Create Config Files

#### 4.1: Ghostty Config (Theme Reference)

**File:** `themes/configs/osaka-jade/ghostty.conf`

```conf
# Osaka Jade theme for Ghostty
# Managed by theme-set - do not edit manually
theme = osaka-jade
```

---

#### 4.2: Neovim Config (Copy from Omarchy + tweaks)

**File:** `themes/configs/osaka-jade/neovim.lua`

**Source:** Omarchy's `neovim.lua` with `lazy = false` added

```lua
-- Osaka Jade theme for Neovim (LazyVim)
-- Managed by theme-set, symlinked to ~/.config/nvim/lua/plugins/theme.lua
-- Source: https://github.com/basecamp/omarchy/tree/master/themes/osaka-jade
return {
  {
    "ribru17/bamboo.nvim",
    lazy = false,
    priority = 1000,
  },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "bamboo",
    },
  },
}
```

---

#### 4.3: SketchyBar Colors (Derive from Ghostty palette)

**File:** `themes/configs/osaka-jade/sketchybar-colors.lua`

```lua
local colors = {
  black = 0xff23372B,
  white = 0xffC1C497,
  red = 0xffFF5345,
  green = 0xff549e6a,
  blue = 0xff509475,
  yellow = 0xffE5C736,
  orange = 0xffE5C736,
  magenta = 0xffD2689C,
  grey = 0xff53685B,
  transparent = 0x00000000,
  highlight = 0x33549e6a,
  bg0 = 0xff111c18,
  bg1 = 0xff1a2520,
  bg2 = 0xff23372B,
}

colors.bar = {
  bg = colors.bg0,
  border = 0xff71CEAD,
}

colors.popup = {
  bg = colors.bg0,
  border = 0xff2DD5B7,
}

return colors
```

---

#### 4.4: Borders Config (Derive from Ghostty palette)

**File:** `themes/configs/osaka-jade/bordersrc`

```bash
#!/usr/bin/env bash
options=(
  style=round
  width=6.0
  hidpi=off
  active_color=0xffC1C497
  inactive_color=0xb323372B
  ax_focus=off
)
borders "${options[@]}"
```

---

#### 4.5: Obsidian Snippet (Derive from Ghostty palette)

**File:** `themes/configs/osaka-jade/obsidian-snippet.css`

```css
:root {
  --nav-item-color-active: #c1c497;
  --nav-item-weight-active: 600;
}

body:not(.is-grabbing) .nav-file-title.is-active,
body:not(.is-grabbing) .nav-folder-title.is-active,
.nav-file-title.is-active,
.nav-folder-title.is-active {
  color: #c1c497 !important;
  background-color: rgba(84, 158, 106, 0.15) !important;
  font-weight: 600 !important;
}

.nav-file-title.is-active .nav-file-title-content::before,
.nav-folder-title.is-active .nav-folder-title-content::before {
  content: "\2726 ";
  color: #c1c497;
  font-weight: 700;
}

.nav-folder-title .nav-folder-title-content {
  color: #c1c497;
  font-weight: 800;
}
.nav-folder-title.is-active .nav-folder-title-content {
  color: #c1c497 !important;
  font-weight: 800;
}

.nav-file-title.is-active .nav-file-title-content,
.nav-folder-title.is-active .nav-folder-title-content {
  color: #c1c497 !important;
  caret-color: #c1c497;
}

.nav-folder.is-collapsed > .nav-folder-title .nav-folder-title-content::before {
  content: "\f07b ";
  font-family: "JetBrainsMono Nerd Font";
  color: #53685b;
  padding-right: 8px;
}
.nav-folder:not(.is-collapsed)
  > .nav-folder-title
  .nav-folder-title-content::before {
  content: "\f07c ";
  font-family: "JetBrainsMono Nerd Font";
  color: #53685b;
  padding-right: 8px;
}

.markdown-source-view.mod-cm6,
.markdown-preview-view {
  --checklist-done-decoration: none !important;
  --checklist-done-color: #53685b !important;
}

.markdown-source-view.mod-cm6 .HyperMD-task-line[data-task="x"],
.markdown-source-view.mod-cm6 .HyperMD-task-line[data-task="X"],
.markdown-source-view.mod-cm6 .task-list-item.is-checked,
.markdown-source-view.mod-cm6 .task-list-item.is-checked .task-list-label,
.markdown-preview-view .task-list-item.is-checked,
.markdown-preview-view .task-list-item.is-checked .task-list-label {
  text-decoration: none !important;
  text-decoration-line: none !important;
  color: #53685b !important;
  opacity: 1 !important;
}
```

---

### Phase 5: Create Wallpapers

#### 5.1: Generate Solid Background (Required)

```bash
cd ~/Projects/Personal/dotfiles/themes
python3 scripts/generate-wallpaper.py "#111c18" wallpapers/osaka-jade/1-solid.png
```

#### 5.2: Download Wallpapers from Omarchy

```bash
cd ~/Projects/Personal/dotfiles/themes/wallpapers/osaka-jade

# List available backgrounds first
# From: https://github.com/basecamp/omarchy/tree/master/themes/osaka-jade/backgrounds

# Download (adjust filenames based on what's in the repo)
curl -L -o 2-osaka-jade.jpg "https://raw.githubusercontent.com/basecamp/omarchy/master/themes/osaka-jade/backgrounds/osaka-jade-bg.jpg"
curl -L -o 3-osaka-jade-alt.jpg "https://raw.githubusercontent.com/basecamp/omarchy/master/themes/osaka-jade/backgrounds/osaka-jade-bg-2.jpg"
```

---

### Phase 6: Update Existing Files

#### 6.1: Update themes.json

**File:** `themes/themes.json`

Add to the `"themes"` array:

```json
{
  "id": "osaka-jade",
  "name": "Osaka Jade",
  "colors": {
    "bg0": "#111c18",
    "bg1": "#1a2520",
    "bg2": "#23372B",
    "fg": "#C1C497",
    "grey": "#53685B",
    "red": "#FF5345",
    "green": "#549e6a",
    "yellow": "#E5C736",
    "blue": "#509475",
    "magenta": "#D2689C",
    "cyan": "#2DD5B7",
    "orange": "#E5C736"
  }
}
```

---

#### 6.2: Update theme-set Script

**File:** `themes/.local/bin/theme-set` (line 30)

**Before:**

```bash
THEMES=(everforest gruvbox tokyo-night)
```

**After:**

```bash
THEMES=(everforest gruvbox tokyo-night osaka-jade)
```

---

### Phase 7: Install External Dependencies

#### 7.1: Obsidian Theme

1. Open Obsidian
2. Settings → Appearance → Themes → Manage
3. Search "Osaka Jade"
4. Install (by sspaeti)

#### 7.2: Antigravity Extension

1. Open Antigravity
2. Extensions (Cmd+Shift+X)
3. Search "Ocean Green"
4. Install `jovejonovski.ocean-green`

---

## Verification Checklist

### Pre-Switch

```bash
# Verify custom Ghostty theme exists
ls -la ~/.config/ghostty/themes/osaka-jade

# Verify all config files exist
ls -la ~/Projects/Personal/dotfiles/themes/configs/osaka-jade/
# Expected: 5 files

# Verify metadata file exists
ls -la ~/Projects/Personal/dotfiles/themes/meta/osaka-jade.env

# Verify wallpapers exist
ls -la ~/Projects/Personal/dotfiles/themes/wallpapers/osaka-jade/
# Expected: 1-3 files

# Verify themes.json is valid
python3 -m json.tool ~/Projects/Personal/dotfiles/themes/themes.json > /dev/null && echo "Valid JSON"
```

### Test Theme Switch

```bash
theme-set osaka-jade
```

### Post-Switch

```bash
# Verify state
cat ~/.config/current-theme
# Expected: osaka-jade

# Verify symlinks
ls -la ~/.config/sketchybar/colors.lua
ls -la ~/.config/ghostty/theme.conf
ls -la ~/.config/borders/bordersrc
ls -la ~/.config/nvim/lua/plugins/theme.lua
```

### Visual Verification

| App        | Expected                              |
| ---------- | ------------------------------------- |
| SketchyBar | Dark green bg (#111c18), jade accents |
| Ghostty    | Dark green bg, cream foreground       |
| Borders    | Cream active, dark inactive           |
| Neovim     | Bamboo theme (quit/reopen)            |
| Obsidian   | Jade-highlighted sidebar              |
| Wallpaper  | Dark green solid or themed            |

---

## Future Enhancements

1. **Custom OpenCode Theme** - Create `~/.config/opencode/themes/osaka-jade.json` with full 50-property theme instead of using `everforest` fallback

2. **Auto-generate Ghostty Themes** - Modify `theme-set` to create custom Ghostty theme files from `.env` palette for themes without built-in support

---

## How to Create a New Theme (AI Agent Guide)

This section provides a reusable template for AI agents to add new themes.

### Step 1: Find Source Theme

Check if the theme exists in:

1. **Omarchy** (`basecamp/omarchy/themes/`) - can copy configs directly
2. **Theme author's repo** - look for terminal configs (ghostty, kitty, alacritty)
3. **Built-in app themes** - Ghostty, Neovim plugins, VS Code extensions

### Step 2: Gather Information

**Required:**

- Color palette (from terminal config like ghostty.conf)
- Neovim plugin + colorscheme name
- VS Code theme name (for Antigravity)
- Obsidian theme name (if exists)

**Check Ghostty built-in themes:**

```bash
ls /Applications/Ghostty.app/Contents/Resources/ghostty/themes/ | grep -i "<theme-name>"
```

If no built-in theme exists, you'll need to create a custom theme file.

### Step 3: Create Files

**If source has matching apps (like Omarchy):**

1. Copy configs directly where possible
2. Adjust format/add comments to match our pattern

**If creating from scratch:**

1. Create `.env` with palette + identifiers
2. Derive each config from the palette:
   - SketchyBar: `0xffRRGGBB` format
   - Borders: `0xffRRGGBB` format
   - Obsidian CSS: `#RRGGBB` and `rgba()` format
   - Ghostty theme: `RRGGBB` (no #) format

### Step 4: File Checklist

```
themes/
├── meta/<theme-id>.env           ← Metadata + identifiers
├── configs/<theme-id>/
│   ├── sketchybar-colors.lua     ← SketchyBar
│   ├── ghostty.conf              ← theme = <name>
│   ├── bordersrc                 ← JankyBorders
│   ├── neovim.lua                ← LazyVim plugin spec
│   └── obsidian-snippet.css      ← Sidebar styling
├── wallpapers/<theme-id>/
│   ├── 1-solid.png               ← Generated from BG_COLOR
│   └── 2-name.jpg                ← Additional wallpapers
└── themes.json                   ← Add entry for Raycast

~/.config/ghostty/themes/<theme-id>  ← If custom theme needed
```

### Step 5: Update theme-set

Edit `.local/bin/theme-set` line 30:

```bash
THEMES=(... <theme-id>)
```

### Step 6: Test

```bash
theme-set <theme-id>
cat ~/.config/current-theme
theme-set --next && theme-set --prev  # Test cycling
```

---

## Summary

| Category                  | Count         |
| ------------------------- | ------------- |
| Files copied from Omarchy | 4             |
| Files created             | 6             |
| Files modified            | 2             |
| External dependencies     | 2             |
| Estimated time            | 15-20 minutes |

**Ready for implementation upon user approval.**
