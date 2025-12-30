# THEME SYSTEM AGENTS

## OVERVIEW

Symlink-based cross-app theme switcher using `theme-set` CLI and `.env` metadata.

## WHERE TO LOOK

- **CLI Logic**: `.local/bin/theme-set` (handles symlinking + app reloads)
- **Theme Definition**: `meta/<theme>.env` (metadata) + `configs/<theme>/` (config files)
- **Visuals**: `wallpapers/<theme>.png` (solid color backgrounds)
- **State**: `~/.config/current-theme` tracks active theme
- **Backups**: `~/.config/theme-backups/` (auto-rotated, last 5 kept)

## CONVENTIONS

- **Symlink Strategy**: `theme-set` links `themes/configs/` files to `~/.config/` targets
- **Metadata Keys**: Mandatory `.env` keys: `THEME_NAME`, `GHOSTTY_THEME`, `NVIM_COLORSCHEME`, `BG_COLOR`
- **Supported Apps**: SketchyBar, Ghostty, Borders, Neovim, P10k, Obsidian, Antigravity, OpenCode
- **Config Mapping**:
  - `sketchybar-colors.lua` -> `~/.config/sketchybar/colors.lua`
  - `neovim.lua` -> `~/.config/nvim/lua/plugins/theme.lua`
  - `ghostty.conf` -> `~/.config/ghostty/theme.conf`
- **JSON Mutation**: Obsidian/Antigravity/OpenCode use Python-based in-place updates

## ANTI-PATTERNS

- **Direct Edits**: Modifying `~/.config/<app>/colors.lua` directly (symlink, will be overwritten)
- **Stow Pollution**: Adding theme-specific color files to Stow packages
- **Incomplete Themes**: Omitting any of the 6 core config files in `configs/<theme>/`
- **Silent Failures**: Missing `source` command in `theme-set` if `.env` structure changes
- **Nvim Folding**: `~/.config/nvim/lua/plugins` as a directory symlink (breaks theme.lua creation)
- **Manual Reloads**: Expecting auto-reload for P10k/Neovim (manual restart required)

## TROUBLESHOOTING

- **Check active theme**: `cat ~/.config/current-theme`
- **Verify links**: `ls -la ~/.config/sketchybar/colors.lua`
- **Fix Nvim folding**: `stow -D nvim && stow --no-folding nvim`
