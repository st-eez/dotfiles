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
  `sketchybar`, `borders`, `tmux`, `wallpaper`, `antigravity`, `opencode`,
  `ghostty_theme`, `pi_theme`)
- `<key>` is target-specific and interpreted only by that target generator
- Unknown targets are invalid unless explicitly supported by the generator set
- Overrides must be additive; core required fields remain authoritative

### `overrides.neovim` Keys

| Key | Type | Default | Notes |
| --- | --- | --- | --- |
| `plugin` | string | `identifiers.nvim_plugin` | Override plugin repo for generated plugin spec. |
| `lazy` | boolean | `false` | Plugin lazy-loading flag in generated Lua table. |
| `priority` | integer | `1000` | Plugin priority in generated Lua table. |
| `dev` | boolean | `false` | Enables local-dev plugin mode (`dev = true`). |
| `background` | string | unset | Sets `vim.g.<colorscheme>_background` unless `background_variable` is set. |
| `background_variable` | string | `<colorscheme>_background` | Lua global name used with `background`. |
| `contrast` | string | unset | Emits `require(<setup_module>).setup({ contrast = ... })`. |
| `setup_module` | string | derived from plugin repo | Lua module passed to `require()` for contrast setup. |
| `config_lua` | string | unset | Raw Lua snippet appended inside plugin `config = function() ... end`. |
| `header_title` | string | `theme.name` | Header text in generated `neovim.lua` comment. |

### `overrides.obsidian` Keys

| Key | Type | Default | Notes |
| --- | --- | --- | --- |
| `variable_prefix` | string | `theme.id` with `-` removed | Prefix used for CSS custom properties. |
| `sidebar_color` | hex `#RRGGBB` | `palette.bg0` | Sidebar/background color variable. |
| `editor_color` | hex `#RRGGBB` | `palette.bg1` | Editor/background color variable. |
| `foreground_color` | hex `#RRGGBB` | `palette.fg` | Primary text color variable. |
| `muted_color` | hex `#RRGGBB` | `palette.grey` | Muted text color variable. |
| `folder_color` | hex `#RRGGBB` | `palette.blue` | Folder title/icon color variable. |
| `active_file_accent` | hex `#RRGGBB` | `palette.blue` | Active file/folder highlight accent. |
| `active_file_alpha` | number (`0..1`) | `0.15` | Alpha used in active row `rgba(...)` background. |

### `overrides.ghostty_theme` Keys

| Key | Type | Default | Notes |
| --- | --- | --- | --- |
| `file` | string | `<theme-id>.ghostty` | Must match `<theme-id>.ghostty`; enables generation of optional custom Ghostty user theme file. |
| `header_title` | string | `theme.name` | Comment title in generated theme file. |
| `background` | hex `#RRGGBB` | `palette.bg0` | Main background color. |
| `foreground` | hex `#RRGGBB` | `palette.fg` | Main foreground color. |
| `cursor_color` | hex `#RRGGBB` | `palette.fg` | Cursor color. |
| `cursor_text` | hex `#RRGGBB` | `palette.bg0` | Cursor text color. |
| `selection_background` | hex `#RRGGBB` | `palette.fg` | Selection background color. |
| `selection_foreground` | hex `#RRGGBB` | `palette.bg0` | Selection foreground color. |
| `color0..color15` | hex `#RRGGBB` | mapped from canonical palette defaults | Override ANSI color slots used in `palette = <index>=<hex>` lines. |

### `overrides.opencode_theme` Keys

| Key | Type | Default | Notes |
| --- | --- | --- | --- |
| `file` | string | `<theme-id>.json` | Must match `<theme-id>.json`; enables generation of optional OpenCode custom theme file. |
| `defs.<name>` | hex `#RRGGBB` | generated from palette transforms | Override generated OpenCode color defs by key. |
| `theme.<token>.dark` | string | generated semantic token mapping | Value must be a defs key or a hex color. |
| `theme.<token>.light` | string | generated semantic token mapping | Value must be a defs key or a hex color. |

### `overrides.pi_theme` Keys

| Key | Type | Default | Notes |
| --- | --- | --- | --- |
| `file` | string | `<theme-id>.json` | Must match `<theme-id>.json`; enables generation of optional Pi custom theme file in `pi/.pi/agent/themes/`. |
| `name` | string | `theme.id` | Pi theme identifier selected by `pi/.pi/agent/settings.json`. |
| `vars.<name>` | hex `#RRGGBB`, integer `0..255`, string, or empty string | generated from palette transforms | Override or add Pi color variables. String values must be hex colors, existing vars keys, or empty string. |
| `colors.<token>` | hex `#RRGGBB`, integer `0..255`, vars key, or empty string | generated semantic token mapping | Override any required Pi color token. Unknown tokens are invalid. |
| `export.pageBg` | hex `#RRGGBB` | `palette.bg0` | Optional `/export` HTML page background. |
| `export.cardBg` | hex `#RRGGBB` | `palette.bg1` | Optional `/export` HTML card background. |
| `export.infoBg` | hex `#RRGGBB` | generated palette mix | Optional `/export` HTML info background. |

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
