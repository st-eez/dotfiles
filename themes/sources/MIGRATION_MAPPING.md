# Migration Mapping and Generation Targets

This document defines the migration contract from canonical theme sources to
generated repository artifacts and to runtime files touched by `theme-set`.

## Ownership Model

- **Source-owned**: edited by humans and reviewed in git.
- **Generated-owned**: overwritten by generator output; do not hand-edit.
- **Runtime-owned**: files in `$HOME` that are linked or mutated by `theme-set`.

## Source -> Generated -> Runtime Mapping

| Theme File Family | Canonical Source (`themes/sources/<theme-id>.toml`) | Generated Target (repo) | Runtime Artifact(s) | Ownership + Manual-Edit Boundary |
| --- | --- | --- | --- | --- |
| Source TOML | Entire file | None (input only) | None | **Source-owned**. This is the only per-theme source of truth to edit. |
| Metadata env | `theme.*`, `identifiers.*`, selected `palette.*` | `themes/meta/<theme-id>.env` | Loaded by `theme-set` | **Generated-owned**. Never edit `themes/meta/*.env` directly. |
| SketchyBar colors | `palette.*`, `overrides.sketchybar.*` | `themes/configs/<theme-id>/sketchybar-colors.lua` | `$HOME/.config/sketchybar/colors.lua` (symlink) | **Generated-owned** in repo, **runtime-owned** at target path. Edit TOML only. |
| Ghostty selector | `identifiers.ghostty`, `overrides.ghostty.*` | `themes/configs/<theme-id>/ghostty.conf` | `$HOME/.config/ghostty/theme.conf` (symlink) | **Generated-owned** in repo. Do not edit either symlink endpoint manually. |
| Borders config | `palette.*`, `overrides.borders.*` | `themes/configs/<theme-id>/bordersrc` | `$HOME/.config/borders/bordersrc` (symlink) | **Generated-owned** in repo. Runtime file is managed by symlink + hot reload. |
| Neovim theme plugin spec | `identifiers.nvim_colorscheme`, `identifiers.nvim_plugin`, `overrides.neovim.*` | `themes/configs/<theme-id>/neovim.lua` | `$HOME/.config/nvim/lua/plugins/theme.lua` (symlink) | **Generated-owned** in repo. If custom colorscheme files are needed, treat those as their own explicit source family. |
| Tmux theme include | `palette.*`, `overrides.tmux.*` | `themes/configs/<theme-id>/tmux.conf` | `$HOME/.config/tmux/theme.conf` (symlink) | **Generated-owned** in repo. Runtime file should not be hand-edited. |
| Obsidian snippet | `palette.*`, `overrides.obsidian.*` | `themes/configs/<theme-id>/obsidian-snippet.css` | `$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Steve_Notes/.obsidian/snippets/active-explorer-color.css` (copied) | **Generated-owned** in repo. Runtime copy is replaceable output. |
| OpenCode custom theme file (optional per theme) | `palette.*`, `overrides.opencode_theme.*` | `themes/configs/<theme-id>/<theme-id>.json` | `$HOME/.config/opencode/themes/<theme-id>.json` (symlink, currently osaka-jade only) | **Generated-owned** when present. Do not hand-edit generated JSON in repo. |
| Raycast theme catalog | `theme.id`, `theme.name`, `palette.*` | `themes/themes.json` (theme entry list) | Consumed by Raycast extension runtime loader | **Generated-owned**. Never patch entries manually once generator is in place. |
| Wallpapers | `palette.bg0` -> managed `1-solid.png`; additional wallpaper assets remain source-owned | `themes/wallpapers/<theme-id>/*` | macOS desktop picture + `$HOME/.config/current-wallpaper` (symlink) | `1-solid.png` is **generated-owned** (from canonical BG color). Other wallpaper files are **source-owned assets**. |
| Legacy palette refs | None (derived convenience artifact) | `themes/palettes/<theme-id>.lua` | None | Treat as **generated-owned** during migration. No manual edits. |

## Runtime Files Updated In-Place (Not Symlinked)

These files stay user-owned, but `theme-set` mutates specific keys:

| Runtime File | Field/Section Mutated | Source Key |
| --- | --- | --- |
| `$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Steve_Notes/.obsidian/appearance.json` | `cssTheme` | `identifiers.obsidian` |
| `$HOME/Library/Application Support/Antigravity/User/settings.json` | `"workbench.colorTheme"` | `identifiers.antigravity` |
| `$HOME/.config/opencode/opencode.json` | `theme` | `identifiers.opencode` |
| `$HOME/.config/current-theme` | full file | `theme.id` |

Backups under `$HOME/.config/theme-backups/` are runtime-only safety artifacts and
are never source-controlled.

## Migration Rules (Enforced Boundary)

1. Edit only `themes/sources/<theme-id>.toml` and wallpaper assets.
2. Treat `themes/meta`, `themes/configs`, `themes/themes.json`, `themes/palettes`,
   and managed wallpaper artifact `themes/wallpapers/<theme-id>/1-solid.png` as generator output.
3. Treat files under `$HOME/.config` and app config directories as runtime state;
   regenerate + reapply with `theme-set` instead of manual drift edits.
