# Modular macOS Theming System - Implementation Plan

**Created**: 2025-12-29
**Status**: Ready for Implementation

## Overview

A zero-dependency theming system that enables one-command theme switching across 9 macOS apps. Uses central Lua palette files following the Omarchy pattern, self-contained within dotfiles.

**Themes**: Tokyo Night, Gruvbox, Everforest

---

## Critical Requirements

1. **Tokyo Night configs are preserved exactly as-is** (except P10k)
   - Current `sketchybar/colors.lua` - DO NOT MODIFY
   - Current `ghostty/config` - DO NOT MODIFY
   - Current `borders/bordersrc` - DO NOT MODIFY
   - Current `nvim/lua/plugins/tokyonight.lua` - DO NOT MODIFY

2. **P10k gets themed for ALL themes** (including Tokyo Night)
   - Replace rainbow colors with theme-matching bubble colors

3. **Wallpaper uses exact same color as SketchyBar bar background** (`bg0`)

4. **Fork official theme CSS/configs from GitHub** - don't reinvent colors

---

## Directory Structure

```
themes/
├── palettes/                    # Central color definitions (Lua)
│   ├── tokyo-night.lua          # Reference palette (matches current setup)
│   ├── gruvbox.lua              # Official Dark Hard variant
│   └── everforest.lua           # Official Dark Medium variant
├── configs/                     # Per-theme app configs
│   ├── tokyo-night/             # Reference (copies of current working configs)
│   │   ├── sketchybar-colors.lua
│   │   ├── bordersrc
│   │   └── p10k-theme.zsh
│   ├── gruvbox/
│   │   ├── sketchybar-colors.lua
│   │   ├── bordersrc
│   │   └── p10k-theme.zsh
│   └── everforest/
│       ├── sketchybar-colors.lua
│       ├── bordersrc
│       └── p10k-theme.zsh
├── obsidian/                    # Forked Obsidian themes
│   ├── tokyo-night/
│   │   ├── manifest.json
│   │   └── theme.css            # From tcmmichaelb139/obsidian-tokyonight
│   ├── gruvbox/
│   │   ├── manifest.json
│   │   └── theme.css            # From insanum/obsidian_gruvbox
│   └── everforest/
│       ├── manifest.json
│       └── theme.css            # From 0xGlitchbyte/obsidian-everforest-theme
├── wallpapers/                  # Pre-generated solid color PNGs
│   ├── tokyo-night.png          # #1a1b26 (same as bar bg)
│   ├── gruvbox.png              # #1d2021
│   └── everforest.png           # #2d353b
├── bin/
│   └── theme-set                # Main CLI script
└── README.md
```

---

## App Coverage

| App             | Method                                     | Auto-reload | Notes                           |
| --------------- | ------------------------------------------ | ----------- | ------------------------------- |
| **SketchyBar**  | Copy pre-made colors.lua                   | Yes         | `sketchybar --reload`           |
| **Ghostty**     | Swap theme name in config                  | Yes         | Watches config file             |
| **Borders**     | Copy pre-made bordersrc                    | Yes         | `brew services restart borders` |
| **Neovim**      | Switch colorscheme plugin                  | No          | Restart or `:colorscheme X`     |
| **P10k**        | Append color overrides                     | No          | `source ~/.p10k.zsh`            |
| **Antigravity** | Update settings.json                       | Yes         | Uses inline colorCustomizations |
| **Obsidian**    | Copy theme folder + update appearance.json | No          | May need vault reload           |
| **Wallpaper**   | Copy PNG + osascript                       | Yes         | Instant                         |
| **Helium**      | SKIP                                       | -           | Phase 2                         |

---

## Official Color Sources

### Tokyo Night (Night variant)

- **Canonical**: [folke/tokyonight.nvim](https://github.com/folke/tokyonight.nvim)
- **Reference file**: `extras/lua/tokyonight_night.lua`

| Color        | Hex       | Usage                     |
| ------------ | --------- | ------------------------- |
| bg           | `#1a1b26` | Background, wallpaper     |
| bg_highlight | `#292e42` | Current line              |
| fg           | `#c0caf5` | Main text                 |
| red          | `#f7768e` | Errors, keywords          |
| orange       | `#ff9e64` | Numbers                   |
| yellow       | `#e0af68` | Warnings                  |
| green        | `#9ece6a` | Strings                   |
| teal         | `#73daca` | Object keys               |
| cyan         | `#7dcfff` | Properties                |
| blue         | `#7aa2f7` | Functions, primary accent |
| magenta      | `#bb9af7` | Keywords                  |
| comment      | `#565f89` | Comments                  |
| black        | `#414868` | Terminal black            |

**Ghostty theme name**: `TokyoNight Night`
**Neovim colorscheme**: `tokyonight-night`

### Gruvbox (Dark Hard variant)

- **Canonical**: [morhetz/gruvbox](https://github.com/morhetz/gruvbox)
- **Reference file**: `colors/gruvbox.vim`

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

**Ghostty theme name**: `Gruvbox Dark Hard`
**Neovim colorscheme**: `gruvbox` (with `contrast = "hard"`)
**Neovim plugin**: `ellisonleao/gruvbox.nvim`

### Everforest (Dark Medium variant)

- **Canonical**: [sainnhe/everforest](https://github.com/sainnhe/everforest)
- **Reference file**: `autoload/everforest.vim`

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

**Ghostty theme name**: `Everforest Dark Hard`
**Neovim colorscheme**: `everforest` (with `vim.g.everforest_background = "medium"`)
**Neovim plugin**: `sainnhe/everforest`

---

## Obsidian Theme Sources

Fork CSS directly from these GitHub repos:

| Theme       | Repository                                                                                          | File to Copy   |
| ----------- | --------------------------------------------------------------------------------------------------- | -------------- |
| Tokyo Night | [tcmmichaelb139/obsidian-tokyonight](https://github.com/tcmmichaelb139/obsidian-tokyonight)         | `theme.css`    |
| Gruvbox     | [insanum/obsidian_gruvbox](https://github.com/insanum/obsidian_gruvbox)                             | `obsidian.css` |
| Everforest  | [0xGlitchbyte/obsidian-everforest-theme](https://github.com/0xGlitchbyte/obsidian-everforest-theme) | `theme.css`    |

---

## Antigravity (VS Code) Approach

Use inline `workbench.colorCustomizations` in settings.json.

Fork colors from official VS Code theme repos:

- Tokyo Night: [tokyo-night/tokyo-night-vscode-theme](https://github.com/tokyo-night/tokyo-night-vscode-theme)
- Gruvbox: [jdinhlife/vscode-theme-gruvbox](https://github.com/jdinhlife/vscode-theme-gruvbox)
- Everforest: [sainnhe/everforest-vscode](https://github.com/sainnhe/everforest-vscode)

**Method**: Generate complete `colorCustomizations` and `tokenColorCustomizations` objects that replicate the theme without needing the extension installed.

---

## P10k Theming Approach

P10k uses ANSI 256-color indices. Strategy:

1. Keep "rainbow" mode structure (colored backgrounds on segments)
2. Replace rainbow colors with theme-appropriate colors
3. Use marker comments to identify generated section

**Segment color mapping**:

| Segment       | Tokyo Night       | Gruvbox          | Everforest       |
| ------------- | ----------------- | ---------------- | ---------------- |
| os_icon       | blue (#7aa2f7)    | blue (#83a598)   | green (#a7c080)  |
| dir           | blue (#7aa2f7)    | blue (#83a598)   | green (#a7c080)  |
| vcs clean     | green (#9ece6a)   | green (#b8bb26)  | green (#a7c080)  |
| vcs modified  | yellow (#e0af68)  | yellow (#fabd2f) | yellow (#dbbc7f) |
| vcs untracked | orange (#ff9e64)  | orange (#fe8019) | orange (#e69875) |
| status ok     | green (#9ece6a)   | green (#b8bb26)  | green (#a7c080)  |
| status error  | red (#f7768e)     | red (#fb4934)    | red (#e67e80)    |
| time          | magenta (#bb9af7) | purple (#d3869b) | purple (#d699b6) |

**Implementation**: Create `p10k-theme.zsh` snippets that get sourced at end of `.p10k.zsh`.

---

## theme-set Script Logic

```bash
#!/usr/bin/env bash
# themes/bin/theme-set

THEME="$1"
DOTFILES="$HOME/Projects/Personal/dotfiles"
THEMES_DIR="$DOTFILES/themes"

# Validate theme
[[ ! -d "$THEMES_DIR/configs/$THEME" ]] && { echo "Unknown theme: $THEME"; exit 1; }

# 1. SketchyBar - copy pre-made config
cp "$THEMES_DIR/configs/$THEME/sketchybar-colors.lua" ~/.config/sketchybar/colors.lua
sketchybar --reload

# 2. Ghostty - update theme line
GHOSTTY_THEME=$(grep "^ghostty_theme=" "$THEMES_DIR/palettes/$THEME.lua" | cut -d'"' -f2)
sed -i '' "s/^theme = .*/theme = $GHOSTTY_THEME/" ~/.config/ghostty/config

# 3. Borders - copy pre-made config
cp "$THEMES_DIR/configs/$THEME/bordersrc" ~/.config/borders/bordersrc
brew services restart borders

# 4. Neovim - update colorscheme in options or dedicated file
# (handled via lua require in nvim config)

# 5. P10k - replace theme section
sed -i '' '/# STEEZ-THEME-START/,/# STEEZ-THEME-END/d' ~/.p10k.zsh
cat "$THEMES_DIR/configs/$THEME/p10k-theme.zsh" >> ~/.p10k.zsh

# 6. Antigravity - update settings.json
# (use jq to update colorCustomizations)

# 7. Obsidian - copy theme to all vaults
for vault in \
    "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Steve_Notes" \
    "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Stel"; do
    if [[ -d "$vault/.obsidian" ]]; then
        rm -rf "$vault/.obsidian/themes/Steez"
        cp -r "$THEMES_DIR/obsidian/$THEME" "$vault/.obsidian/themes/Steez"
        # Update appearance.json to use Steez theme
        jq '.cssTheme = "Steez"' "$vault/.obsidian/appearance.json" > /tmp/obs.json
        mv /tmp/obs.json "$vault/.obsidian/appearance.json"
    fi
done

# 8. Wallpaper
WALLPAPER="$THEMES_DIR/wallpapers/$THEME.png"
osascript -e "tell application \"System Events\" to tell every desktop to set picture to POSIX file \"$WALLPAPER\""

# Save current theme
echo "$THEME" > ~/.config/current-theme

echo "Theme set to: $THEME"
echo ""
echo "Manual steps:"
echo "  - Neovim: :colorscheme <name> or restart"
echo "  - Zsh: source ~/.p10k.zsh"
echo "  - Obsidian: Restart or reload vault"
```

---

## Implementation Phases

### Phase 1: Setup Structure

1. Create `themes/` directory structure
2. Create palette files from official sources
3. Copy current Tokyo Night configs as reference

### Phase 2: Generate Gruvbox/Everforest Configs

1. Generate `sketchybar-colors.lua` for each
2. Generate `bordersrc` for each
3. Create P10k theme snippets for all three

### Phase 3: Fork Obsidian Themes

1. Download official theme.css from GitHub
2. Create manifest.json for each
3. Test in Obsidian

### Phase 4: Antigravity Integration

1. Extract colorCustomizations from official VS Code themes
2. Create settings.json merge logic

### Phase 5: Neovim Plugin Setup

1. Add gruvbox.nvim and everforest plugins to lazy config
2. Create theme switching mechanism

### Phase 6: Wallpapers & Script

1. Generate solid color PNGs
2. Create theme-set script
3. Test full switching flow

### Phase 7: Documentation

1. Update README
2. Fresh install instructions

---

## Files to Create

| File                                               | Description                   |
| -------------------------------------------------- | ----------------------------- |
| `themes/palettes/tokyo-night.lua`                  | Tokyo Night color definitions |
| `themes/palettes/gruvbox.lua`                      | Gruvbox color definitions     |
| `themes/palettes/everforest.lua`                   | Everforest color definitions  |
| `themes/configs/tokyo-night/sketchybar-colors.lua` | Copy of current               |
| `themes/configs/tokyo-night/bordersrc`             | Copy of current               |
| `themes/configs/tokyo-night/p10k-theme.zsh`        | New - themed colors           |
| `themes/configs/gruvbox/sketchybar-colors.lua`     | Generated                     |
| `themes/configs/gruvbox/bordersrc`                 | Generated                     |
| `themes/configs/gruvbox/p10k-theme.zsh`            | Generated                     |
| `themes/configs/everforest/sketchybar-colors.lua`  | Generated                     |
| `themes/configs/everforest/bordersrc`              | Generated                     |
| `themes/configs/everforest/p10k-theme.zsh`         | Generated                     |
| `themes/obsidian/tokyo-night/theme.css`            | Forked from GitHub            |
| `themes/obsidian/tokyo-night/manifest.json`        | Created                       |
| `themes/obsidian/gruvbox/theme.css`                | Forked from GitHub            |
| `themes/obsidian/gruvbox/manifest.json`            | Created                       |
| `themes/obsidian/everforest/theme.css`             | Forked from GitHub            |
| `themes/obsidian/everforest/manifest.json`         | Created                       |
| `themes/wallpapers/tokyo-night.png`                | Solid #1a1b26                 |
| `themes/wallpapers/gruvbox.png`                    | Solid #1d2021                 |
| `themes/wallpapers/everforest.png`                 | Solid #2d353b                 |
| `themes/bin/theme-set`                             | Main CLI script               |
| `themes/README.md`                                 | Usage documentation           |

---

## Files to Modify

| File                             | Change                                  |
| -------------------------------- | --------------------------------------- |
| `nvim/.config/nvim/lua/plugins/` | Add gruvbox.nvim and everforest plugins |
| `zsh/.p10k.zsh`                  | Add theme section markers at end        |

---

## Skipped (Phase 2)

- **Helium browser** - Chrome theme folder approach, experimental
