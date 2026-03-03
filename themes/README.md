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

## Wallpaper Cycling

Cycle through wallpapers within the current theme using the `wallpaper-set` CLI:

```bash
# Show current wallpaper status
wallpaper-set

# Cycle wallpapers
wallpaper-set --next    # or -n
wallpaper-set --prev    # or -p
wallpaper-set --random  # or -r

# Set specific wallpaper (1-indexed)
wallpaper-set 2
```

> **Tip**: Use the Raycast **"Cycle Wallpaper"** command to quickly cycle wallpapers. Assign a hotkey in Raycast preferences (e.g., `Ctrl + Alt + Cmd + Space`).

Wallpapers are stored in per-theme directories: `themes/wallpapers/<theme-name>/`.

## Supported Apps

| App         | Method               | Auto-reload      |
| ----------- | -------------------- | ---------------- |
| SketchyBar  | Symlink colors.lua   | Yes              |
| Ghostty     | Symlink theme.conf   | Yes (SIGUSR2)    |
| Borders     | Symlink bordersrc    | Yes              |
| Tmux        | Symlink theme.conf   | Yes (`source-file`) |
| Wallpaper   | osascript            | Yes              |
| Antigravity | Edit settings.json   | Yes              |
| Obsidian    | Edit appearance.json | Yes              |
| Neovim      | Symlink theme.lua    | No (quit/reopen) |
| OpenCode    | Edit opencode.json   | No (restart)     |

> **Note**: Starship prompt theming pending. Configure manually with `starship config`.

## Available Themes

| Theme       | Background | Accent | Source                                                            |
| ----------- | ---------- | ------ | ----------------------------------------------------------------- |
| Tokyo Night | `#1a1b26`  | Blue   | [folke/tokyonight.nvim](https://github.com/folke/tokyonight.nvim) |
| Gruvbox     | `#1d2021`  | Orange | [morhetz/gruvbox](https://github.com/morhetz/gruvbox)             |
| Everforest  | `#2d353b`  | Green  | [sainnhe/everforest](https://github.com/sainnhe/everforest)       |

Canonical upstream file + ref pinning decisions are tracked in
`themes/sources/CANONICAL_UPSTREAMS.md`.

Migration ownership boundaries and generation targets are tracked in
`themes/sources/MIGRATION_MAPPING.md`.

## Source of Truth + Drift Prevention

Per-theme source of truth is `themes/sources/<theme-id>.toml` (plus optional wallpaper assets `themes/wallpapers/<theme-id>/2-*`, `3-*`, etc.).

Never hand-edit generated artifacts:

- `themes/meta/<theme-id>.env`
- `themes/configs/<theme-id>/*`
- `themes/themes.json`
- `themes/wallpapers/<theme-id>/1-solid.png`

Recommended workflow before commit:

```bash
DOTFILES="$HOME/Projects/Personal/dotfiles"
python3 "$DOTFILES/themes/scripts/theme_build.py" --check
python3 "$DOTFILES/themes/scripts/theme_build.py" --generate-meta
python3 "$DOTFILES/themes/scripts/theme_build.py" --generate-themes-json
python3 "$DOTFILES/themes/scripts/theme_build.py" --generate-configs
python3 "$DOTFILES/themes/scripts/theme_build.py" --generate-wallpapers
python3 -m unittest "$DOTFILES/themes/tests/test_theme_build.py"
git diff --exit-code -- "$DOTFILES/themes/meta" "$DOTFILES/themes/themes.json" "$DOTFILES/themes/configs" "$DOTFILES/themes/wallpapers"
```

## Adding a New Theme

1. Create `themes/sources/<name>.toml` using `themes/sources/SCHEMA.md`.
2. Add optional wallpaper assets as `themes/wallpapers/<name>/2-*.png|jpg` and higher. `1-solid.png` is generated.
3. Regenerate artifacts:

   ```bash
   DOTFILES="$HOME/Projects/Personal/dotfiles"
   python3 "$DOTFILES/themes/scripts/theme_build.py" --generate-meta
   python3 "$DOTFILES/themes/scripts/theme_build.py" --generate-themes-json
   python3 "$DOTFILES/themes/scripts/theme_build.py" --generate-configs
   python3 "$DOTFILES/themes/scripts/theme_build.py" --generate-wallpapers
   ```

4. Validate:

   ```bash
   DOTFILES="$HOME/Projects/Personal/dotfiles"
   python3 "$DOTFILES/themes/scripts/theme_build.py" --check
   python3 -m unittest "$DOTFILES/themes/tests/test_theme_build.py"
   theme-set <name>
   ```

## File Structure

```
themes/
├── .local/bin/theme-set   # CLI script (Stow → ~/.local/bin/)
├── sources/*.toml         # Canonical per-theme source of truth
├── scripts/theme_build.py # Source validator + artifact generators
├── meta/*.env             # Generated metadata for theme-set
├── configs/<theme>/       # Generated per-app configs
├── themes.json            # Generated manifest for Raycast + theme-set
└── wallpapers/<theme>/    # 1-solid.png generated; N>1 assets optional/manual
```

## How It Works

Theme-variable files are NOT in Stow packages. Instead:

1. Stow creates symlinks for base configs (sketchybar items, nvim plugins, etc.)
2. `theme-set` reads generated `themes/themes.json` to discover available themes.
3. `theme-set` creates symlinks for theme files:
   ```
   ~/.config/sketchybar/colors.lua -> themes/configs/<theme>/sketchybar-colors.lua
   ~/.config/nvim/lua/plugins/theme.lua -> themes/configs/<theme>/neovim.lua
   ```
4. Apps reload automatically or require restart

## Backups

Before modifying JSON configs (Obsidian, Antigravity, OpenCode), theme-set creates backups:

```
~/.config/theme-backups/<timestamp>/
```

Only the last 5 backup directories are retained.

## Troubleshooting

**"plugins/ is a symlink" error**:

```bash
cd "$HOME/Projects/Personal/dotfiles"
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
