# Canonical Theme Source TOML Schema

This document defines the canonical schema for `themes/sources/<theme-id>.toml`.
The schema is strict by default: unknown keys are invalid except inside `overrides.*`.

Upstream repository/ref/file decisions are documented in
`themes/sources/CANONICAL_UPSTREAMS.md`.

Migration ownership and source->generated->runtime mapping are documented in
`themes/sources/MIGRATION_MAPPING.md`.

## Path + Naming Conventions

- File path: `themes/sources/<theme-id>.toml`
- `<theme-id>` must be kebab-case: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- IDs must be stable once published (no renaming in place)
- All strings must be UTF-8 and trimmed (no leading/trailing whitespace)

## Required Key List

| Key Path | Type | Required | Notes |
| --- | --- | --- | --- |
| `schema_version` | integer | yes | Current value: `1` |
| `theme.id` | string | yes | Must match filename `<theme-id>` |
| `theme.name` | string | yes | Human display name |
| `theme.variant` | string | yes | Variant label (`night`, `dark-hard`, etc.) |
| `theme.source` | string | yes | Canonical upstream URL |
| `identifiers.ghostty` | string | yes | Ghostty theme identifier |
| `identifiers.nvim_colorscheme` | string | yes | Neovim colorscheme name |
| `identifiers.antigravity` | string | yes | Antigravity theme name |
| `identifiers.opencode` | string | yes | OpenCode theme id |
| `identifiers.obsidian` | string | yes | Obsidian theme name |
| `palette.bg0` | string | yes | Primary background |
| `palette.bg1` | string | yes | Secondary background |
| `palette.bg2` | string | yes | Tertiary/dark accent background |
| `palette.fg` | string | yes | Primary foreground |
| `palette.grey` | string | yes | Muted/neutral text |
| `palette.red` | string | yes | Accent |
| `palette.orange` | string | yes | Accent |
| `palette.yellow` | string | yes | Accent |
| `palette.green` | string | yes | Accent |
| `palette.cyan` | string | yes | Accent |
| `palette.blue` | string | yes | Accent |
| `palette.magenta` | string | yes | Accent |

## Optional Keys

| Key Path | Type | Notes |
| --- | --- | --- |
| `identifiers.nvim_plugin` | string | Neovim plugin repo (`author/plugin.nvim`) |
| `overrides.<target>.<key>` | any TOML scalar/array/table | App or artifact-specific override surface |

If an optional key is not used, omit it. Do not use empty-string placeholders.

## Color Format Rules

- Color values in `palette.*` must be hex strings in `#RRGGBB` format.
- Regex: `^#[0-9a-fA-F]{6}$`
- Canonical style is lowercase hex (`#rrggbb`) in source files.
- Alpha is not stored in source palette values; generators add alpha where needed
  (for example SketchyBar `0xffRRGGBB`, highlight tints, Borders inactive alpha).

## Identifier Field Rules

- `identifiers.*` values are exact upstream identifiers used by each app.
- These values are not normalized by generators.
- `identifiers.nvim_plugin` is optional because local/custom Neovim themes may not
  require a plugin dependency.

## Override Structure

Overrides are target-scoped and extend/replace generator defaults without changing
the canonical palette or identifiers:

- Namespace shape: `overrides.<target>.<key> = <value>`
- `<target>` is the artifact/app key (examples: `neovim`, `ghostty`, `obsidian`,
  `sketchybar`, `borders`, `tmux`, `wallpaper`, `antigravity`, `opencode`)
- `<key>` is target-specific and interpreted only by that target generator
- Unknown targets are invalid unless explicitly supported by the generator set
- Overrides must be additive; core required fields remain authoritative

## Concrete Example (`themes/sources/tokyo-night.toml`)

```toml
schema_version = 1

[theme]
id = "tokyo-night"
name = "Tokyo Night"
variant = "night"
source = "https://github.com/folke/tokyonight.nvim"

[identifiers]
ghostty = "TokyoNight"
nvim_colorscheme = "tokyonight-night"
nvim_plugin = "folke/tokyonight.nvim"
antigravity = "Tokyo Night"
opencode = "tokyonight"
obsidian = "Tokyo Night"

[palette]
bg0 = "#1a1b26"
bg1 = "#24283b"
bg2 = "#414868"
fg = "#c0caf5"
grey = "#565f89"
red = "#f7768e"
orange = "#ff9e64"
yellow = "#e0af68"
green = "#9ece6a"
cyan = "#7dcfff"
blue = "#7aa2f7"
magenta = "#bb9af7"

[overrides.obsidian]
active_file_accent = "#7aa2f7"
```

## Validation Summary

1. Filename id == `theme.id`
2. All required keys present
3. All `palette.*` values match `#RRGGBB`
4. No unknown top-level keys outside `overrides`
5. `overrides` only contains supported targets
