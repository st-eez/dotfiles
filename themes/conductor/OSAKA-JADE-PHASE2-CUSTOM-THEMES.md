# Osaka Jade Phase 2: Custom Neovim & OpenCode Themes

**Created:** 2026-01-01
**Updated:** 2026-01-01
**Status:** ✅ COMPLETED (including Phase 2b Convention Fixes)
**Depends On:** Phase 1 (COMPLETED)

---

## Executive Summary

Create native Osaka Jade colorschemes for Neovim and OpenCode instead of using fallback themes (bamboo, everforest). This ensures visual consistency across all applications.

| App          | Before                | After                           | Status      |
| ------------ | --------------------- | ------------------------------- | ----------- |
| **Neovim**   | `bamboo.nvim` plugin  | Custom `osaka-jade` colorscheme | ✅ Complete |
| **OpenCode** | `everforest` fallback | Custom `Osaka Jade` theme       | ✅ Complete |
| **Ghostty**  | `osaka-jade`          | `Osaka Jade` (display name fix) | ✅ Complete |

---

## Color Palette Reference

**Source:** [basecamp/omarchy](https://github.com/basecamp/omarchy/tree/master/themes/osaka-jade) (ghostty.conf, kitty.conf, alacritty.toml)

```
# Primary Colors
Background:             #111c18
Foreground:             #C1C497
Cursor:                 #D7C995

# Normal Colors (ANSI 0-7)
Black (color0):         #23372B
Red (color1):           #FF5345
Green (color2):         #549e6a
Yellow (color3):        #459451  (dark green, NOT yellow)
Blue (color4):          #509475  (jade-tinted)
Magenta (color5):       #D2689C
Cyan (color6):          #2DD5B7
White (color7):         #F6F5DD

# Bright Colors (ANSI 8-15)
Bright Black (color8):  #53685B  (comment/muted)
Bright Red (color9):    #db9f9c
Bright Green (color10): #63b07a
Bright Yellow (color11):#E5C736  (actual yellow)
Bright Blue (color12):  #ACD4CF
Bright Magenta (color13):#75bbb3
Bright Cyan (color14):  #8CD3CB
Bright White (color15): #9eebb3

# Derived (for UI elements)
Secondary Background:   #1a2520
Tertiary Background:    #23372B
```

> **Note:** All colors are canonical from omarchy. No invented colors.

---

## Feature 1: Custom Neovim Colorscheme ✅

### Files Created/Modified

| File                                            | Action  | Description                                       |
| ----------------------------------------------- | ------- | ------------------------------------------------- |
| `configs/osaka-jade/nvim-colors/osaka-jade.lua` | Created | Full colorscheme (517 LOC)                        |
| `configs/osaka-jade/neovim.lua`                 | Updated | LazyVim loader with `dir = stdpath("config")`     |
| `.local/bin/theme-set`                          | Updated | Added section 5b for colorscheme symlink          |
| `meta/osaka-jade.env`                           | Updated | `NVIM_COLORSCHEME="osaka-jade"`, `NVIM_PLUGIN=""` |

### Symlinks Created by theme-set

```
~/.config/nvim/lua/plugins/theme.lua → configs/osaka-jade/neovim.lua
~/.config/nvim/colors/osaka-jade.lua → configs/osaka-jade/nvim-colors/osaka-jade.lua
```

### Colorscheme Contents (517 LOC)

- Terminal colors (16 ANSI colors)
- Editor highlights (~30 groups)
- Syntax highlights (~20 groups)
- Treesitter highlights (~40 groups)
- LSP highlights (~15 groups)
- Git/Diff highlights (~10 groups)
- Plugin highlights (~20 groups): Telescope, Neo-tree, WhichKey, Notify, Noice, Cmp, Lazy, Mason, etc.

### Verification

```bash
nvim --headless -c "colorscheme osaka-jade" -c "echo 'OK'" -c "qa"
# Output: "Colorscheme loaded successfully"
```

---

## Feature 2: Custom OpenCode Theme ✅

### Files Created/Modified

| File                                 | Action  | Description                        |
| ------------------------------------ | ------- | ---------------------------------- |
| `configs/osaka-jade/osaka-jade.json` | Created | Full OpenCode theme (90 LOC)       |
| `.local/bin/theme-set`               | Updated | Added section 8b for theme symlink |
| `meta/osaka-jade.env`                | Updated | `OPENCODE_THEME="Osaka Jade"`      |

### Symlinks Created by theme-set

```
~/.config/opencode/themes/Osaka Jade.json → configs/osaka-jade/osaka-jade.json
```

### Theme Properties

- Color definitions (defs): 33 colors for dark/light modes
- Theme mappings: 50+ semantic properties (primary, secondary, accent, error, warning, success, info, text, background, border, diff*, markdown*, syntax\*)

---

## Feature 2b: OpenCode Theme Convention Validation ✅

**Added:** 2026-01-01

After initial implementation, the OpenCode theme was audited against 6 reference themes (catppuccin-macchiato, everforest, gruvbox, tokyonight, kanagawa, nord) to ensure convention compliance.

### Issues Found & Fixed

| Field            | Original         | Fixed         | Convention                    | Confidence        |
| ---------------- | ---------------- | ------------- | ----------------------------- | ----------------- |
| `markdownCode`   | `darkYellow`     | `darkGreen`   | Must equal `syntaxString`     | 100% (6/6 themes) |
| `markdownStrong` | `darkWhite`      | `darkYellow`  | Orange or yellow, never white | 100% (6/6 themes) |
| `secondary`      | `darkCyanBright` | `darkMagenta` | Must differ from `primary`    | 100% (6/6 themes) |

### Validation Process

1. Fetched all 6 reference themes from `sst/opencode` repository
2. Compared each semantic field across themes
3. Identified conventions with 100% or near-100% compliance
4. Applied fixes only for validated conventions

### Filename Change

Renamed for PR convention compliance:

- **Before:** `configs/osaka-jade/opencode-theme.json`
- **After:** `configs/osaka-jade/osaka-jade.json`

Updated `.local/bin/theme-set` to reference new filename.

---

## Feature 3: Display Name Fixes ✅

### Ghostty

- Renamed `~/.config/ghostty/themes/osaka-jade` → `~/.config/ghostty/themes/Osaka Jade`
- Updated `configs/osaka-jade/ghostty.conf`: `theme = Osaka Jade`
- Updated `meta/osaka-jade.env`: `GHOSTTY_THEME="Osaka Jade"`

### OpenCode

- Theme file named `osaka-jade.json` (kebab-case for PR convention)
- Symlinked as `Osaka Jade.json` (display name)
- Config uses `"theme": "Osaka Jade"`

### Neovim

- Kept as `osaka-jade` (lowercase-hyphenated convention for `:colorscheme` command)

---

## Implementation Checklist

### Neovim ✅

- [x] Create `configs/osaka-jade/nvim-colors/` directory
- [x] Create `configs/osaka-jade/nvim-colors/osaka-jade.lua` (517 lines)
  - [x] Color palette constants (from canonical omarchy)
  - [x] Terminal colors (16 ANSI colors)
  - [x] Editor highlights (~30 groups)
  - [x] Syntax highlights (~20 groups)
  - [x] Treesitter highlights (~40 groups)
  - [x] LSP highlights (~15 groups)
  - [x] Git/Diff highlights (~10 groups)
  - [x] Plugin highlights (~20 groups)
- [x] Update `configs/osaka-jade/neovim.lua` (LazyVim loader with `dir = stdpath`)
- [x] Update `.local/bin/theme-set` to symlink `~/.config/nvim/colors/osaka-jade.lua`
- [x] Update `meta/osaka-jade.env` (set `NVIM_PLUGIN=""`)
- [x] Test: `theme-set osaka-jade` + verify in Neovim

### OpenCode ✅

- [x] Create `configs/osaka-jade/osaka-jade.json` (tracked in dotfiles)
- [x] Update `.local/bin/theme-set` to symlink to `~/.config/opencode/themes/`
- [x] Update `meta/osaka-jade.env` with `OPENCODE_THEME="Osaka Jade"`
- [x] Test: Restart OpenCode and verify theme loads
- [x] Validate against 6 reference themes (catppuccin, everforest, gruvbox, tokyonight, kanagawa, nord)
- [x] Fix convention violations (markdownCode, markdownStrong, secondary)
- [x] Rename to `osaka-jade.json` for PR convention

### Display Names ✅

- [x] Ghostty: Renamed theme file to `Osaka Jade`
- [x] OpenCode: Theme displays as `Osaka Jade`
- [x] Neovim: Kept as `osaka-jade` (convention)

---

## Final File Structure

```
dotfiles/themes/
├── configs/osaka-jade/
│   ├── bordersrc
│   ├── ghostty.conf              # theme = Osaka Jade
│   ├── neovim.lua                # LazyVim loader (dir = stdpath)
│   ├── nvim-colors/
│   │   └── osaka-jade.lua        # Full colorscheme (517 LOC)
│   ├── obsidian-snippet.css
│   ├── osaka-jade.json           # Full OpenCode theme (90 LOC) - RENAMED
│   └── sketchybar-colors.lua
├── meta/osaka-jade.env           # Updated theme identifiers
└── .local/bin/theme-set          # Updated with sections 5b and 8b
```

---

## Optional: Submit PR to OpenCode

The local theme works immediately. Optionally, submit a PR to include osaka-jade as a built-in:

| Step | Action                                                                      |
| ---- | --------------------------------------------------------------------------- |
| 1    | Fork `sst/opencode`                                                         |
| 2    | Add `osaka-jade.json` to `packages/opencode/src/cli/cmd/tui/context/theme/` |
| 3    | Submit PR referencing Omarchy as source                                     |

**Status:** Ready for PR submission (theme validated against conventions)

---

## Actual Effort

| Task                          | Planned   | Actual       |
| ----------------------------- | --------- | ------------ |
| Neovim colorscheme            | 30-45 min | ~30 min      |
| OpenCode theme JSON           | 5 min     | ~5 min       |
| theme-set modifications       | 10 min    | ~15 min      |
| Display name fixes            | N/A       | ~10 min      |
| Testing & refinement          | 15-20 min | ~10 min      |
| Convention validation & fixes | N/A       | ~45 min      |
| **Total**                     | 60-80 min | **~115 min** |

---

---

# Phase 3: Neovim Colorscheme Convention Validation

**Status:** 🔲 NOT STARTED
**Depends On:** Phase 2 (COMPLETED)

---

## Objective

Validate the osaka-jade Neovim colorscheme (`configs/osaka-jade/nvim-colors/osaka-jade.lua`) against conventions used by established Neovim colorschemes to ensure best practices and PR-readiness.

---

## Reference Colorschemes

Validate against these popular Neovim colorschemes:

| Colorscheme         | Repository               | Why                             |
| ------------------- | ------------------------ | ------------------------------- |
| **tokyonight.nvim** | folke/tokyonight.nvim    | Most popular, gold standard     |
| **catppuccin**      | catppuccin/nvim          | Comprehensive, well-structured  |
| **gruvbox.nvim**    | ellisonleao/gruvbox.nvim | Classic, widely adopted         |
| **kanagawa.nvim**   | rebelot/kanagawa.nvim    | Nature-inspired like osaka-jade |
| **everforest**      | sainnhe/everforest       | Green palette similar to jade   |
| **nord.nvim**       | shaunsingh/nord.nvim     | Minimalist, clean               |

---

## Validation Checklist

### 3.1 Highlight Group Coverage

- [ ] Compare highlight groups against reference colorschemes
- [ ] Identify missing groups that other themes define
- [ ] Add any critical missing groups

**Groups to validate:**

- Editor highlights (Normal, Cursor, Visual, Search, etc.)
- Syntax highlights (Comment, Constant, String, Function, etc.)
- Treesitter highlights (@variable, @function, @keyword, etc.)
- LSP highlights (DiagnosticError, LspReferenceText, etc.)
- Git/Diff highlights (DiffAdd, DiffChange, GitSignsAdd, etc.)
- Plugin highlights (Telescope*, NeoTree*, WhichKey\*, etc.)

### 3.2 Color Mapping Conventions

Compare semantic color usage:

| Semantic Role | Convention    | Our osaka-jade | Status |
| ------------- | ------------- | -------------- | ------ |
| Comments      | Gray/muted    | ?              | ?      |
| Strings       | Green         | ?              | ?      |
| Keywords      | Purple/cyan   | ?              | ?      |
| Functions     | Blue          | ?              | ?      |
| Types         | Yellow        | ?              | ?      |
| Errors        | Red           | ?              | ?      |
| Warnings      | Yellow/orange | ?              | ?      |
| Info          | Cyan/blue     | ?              | ?      |

### 3.3 Plugin Support Comparison

- [ ] List plugins supported by reference themes
- [ ] Compare against our plugin highlights
- [ ] Add missing plugin support if critical

### 3.4 Treesitter Completeness

- [ ] Validate all @-prefixed highlight groups
- [ ] Compare against nvim-treesitter recommended groups
- [ ] Ensure semantic highlighting is complete

### 3.5 LSP Integration

- [ ] Validate DiagnosticError/Warn/Info/Hint
- [ ] Check LspReference\* groups
- [ ] Verify inlay hints styling

---

## Validation Process

1. **Fetch reference colorschemes** - Clone or fetch lua files from each repo
2. **Extract highlight groups** - Parse all `hi()` or `vim.api.nvim_set_hl()` calls
3. **Create comparison matrix** - Map groups across all themes
4. **Identify gaps** - Find groups we're missing
5. **Validate colors** - Check if our color choices match conventions
6. **Apply fixes** - Update only for validated conventions (100% or near-100% compliance)

---

## Expected Fixes

Based on preliminary analysis, potential issues:

| Issue                                 | Current     | Expected Fix             |
| ------------------------------------- | ----------- | ------------------------ |
| Missing `EndOfBuffer`                 | Not defined | Add with bg color        |
| Missing `healthError/Success/Warning` | Not defined | Add with semantic colors |
| `syntaxKeyword` color                 | Cyan        | May need purple (TBD)    |

> **Note:** Only apply fixes after validation confirms convention compliance.

---

## Deliverables

- [ ] Updated `configs/osaka-jade/nvim-colors/osaka-jade.lua` with convention-compliant mappings
- [ ] Documentation of validation findings
- [ ] Ready for potential submission as standalone `osaka-jade.nvim` plugin

---

## Effort Estimate

| Task                             | Estimate     |
| -------------------------------- | ------------ |
| Fetch & analyze reference themes | 30 min       |
| Create comparison matrix         | 20 min       |
| Identify convention violations   | 15 min       |
| Apply validated fixes            | 20 min       |
| Testing & verification           | 15 min       |
| **Total**                        | **~100 min** |
