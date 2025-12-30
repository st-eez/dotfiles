# Theme System

One-command theme switching across macOS apps.

## Quick Start

```bash
# List available themes
theme-set

# Switch theme
theme-set tokyo-night    # Default
theme-set gruvbox
theme-set everforest

# Cycle themes
theme-set --next         # or -n
theme-set --prev         # or -p
```

## Supported Apps

| App         | Method                 | Auto-reload      |
| ----------- | ---------------------- | ---------------- |
| SketchyBar  | Symlink colors.lua     | Yes              |
| Ghostty     | Symlink theme.conf     | Yes (SIGUSR2)    |
| Borders     | Symlink bordersrc      | Yes              |
| P10k        | Symlink p10k.theme.zsh | Yes (hot-reload) |
| Wallpaper   | osascript              | Yes              |
| Antigravity | Edit settings.json     | Yes              |
| Obsidian    | Edit appearance.json   | Yes              |
| Neovim      | Symlink theme.lua      | No (quit/reopen) |
| OpenCode    | Edit opencode.json     | No (restart)     |

## Available Themes

| Theme       | Background | Accent | Source                                                            |
| ----------- | ---------- | ------ | ----------------------------------------------------------------- |
| Tokyo Night | `#1a1b26`  | Blue   | [folke/tokyonight.nvim](https://github.com/folke/tokyonight.nvim) |
| Gruvbox     | `#1d2021`  | Orange | [morhetz/gruvbox](https://github.com/morhetz/gruvbox)             |
| Everforest  | `#2d353b`  | Green  | [sainnhe/everforest](https://github.com/sainnhe/everforest)       |

## Adding a New Theme

1. Create metadata file `themes/meta/<name>.env`:

   ```bash
   THEME_NAME="Display Name"
   THEME_VARIANT="variant"
   GHOSTTY_THEME="GhosttyThemeName"
   NVIM_COLORSCHEME="colorscheme-name"
   ANTIGRAVITY_THEME="VS Code Theme Name"
   OPENCODE_THEME="opencode-theme"
   OBSIDIAN_THEME="Obsidian Theme"
   BG_COLOR="#rrggbb"
   ```

2. Create config files in `themes/configs/<name>/`:
   - `sketchybar-colors.lua` - SketchyBar color table
   - `bordersrc` - JankyBorders config script
   - `ghostty.conf` - Ghostty theme include
   - `neovim.lua` - LazyVim colorscheme spec
   - `p10k-theme.zsh` - Powerlevel10k overrides
   - `obsidian-snippet.css` - Sidebar styling

3. Create wallpaper `themes/wallpapers/<name>.png` - solid color matching background

4. Test: `theme-set <name>`

## File Structure

```
themes/
├── .local/bin/theme-set   # CLI script (Stow → ~/.local/bin/)
├── meta/*.env             # Theme metadata
├── configs/<theme>/       # Per-app configs
├── palettes/*.lua         # Color reference (optional)
└── wallpapers/*.png       # Desktop backgrounds
```

## How It Works

Theme-variable files are NOT in Stow packages. Instead:

1. Stow creates symlinks for base configs (sketchybar items, nvim plugins, etc.)
2. `theme-set` creates symlinks for theme files:
   ```
   ~/.config/sketchybar/colors.lua -> themes/configs/<theme>/sketchybar-colors.lua
   ~/.config/nvim/lua/plugins/theme.lua -> themes/configs/<theme>/neovim.lua
   ```
3. Apps reload automatically or require restart

## Backups

Before modifying JSON configs (Obsidian, Antigravity, OpenCode), theme-set creates backups:

```
~/.config/theme-backups/<timestamp>/
```

Only the last 5 backup directories are retained.

## Troubleshooting

**"plugins/ is a symlink" error**:

```bash
cd ~/dotfiles
stow -D nvim && stow --no-folding nvim
```

**Theme not applied after install**:

```bash
theme-set tokyo-night
```

**Check current theme**:

```bash
cat ~/.config/current-theme
```

**Verify symlinks**:

```bash
ls -la ~/.config/sketchybar/colors.lua
ls -la ~/.config/nvim/lua/plugins/theme.lua
```
