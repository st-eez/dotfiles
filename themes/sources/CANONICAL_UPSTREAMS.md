# Canonical Upstream Decisions and Pinning Policy

This document records the canonical upstream source tuple for each currently
supported theme and the pinning policy for reproducible generation.

## Decision Table (As of 2026-03-03)

| Theme ID | Canonical Upstream Repo | Canonical File(s) | Variant | Pinned Ref | Pinning Strategy |
| --- | --- | --- | --- | --- | --- |
| `tokyo-night` | `https://github.com/folke/tokyonight.nvim` | `extras/ghostty/tokyonight_night` | `night` | `5da1b76e64daf4c5d410f06bcb6b9cb640da7dfd` | Pin exact commit SHA from upstream default branch. Never pin a branch name. |
| `gruvbox` | `https://github.com/morhetz/gruvbox` | `colors/gruvbox.vim` | `dark-hard` | `697c00291db857ca0af00ec154e5bd514a79191f` | Pin exact commit SHA from upstream default branch. Never pin a branch name. |
| `everforest` | `https://github.com/sainnhe/everforest` | `palette.md`, `autoload/everforest.vim` | `dark-medium` | `b03a03148c8b34c24c96960b93da9c8883d11f54` | Pin exact commit SHA from upstream default branch. Never pin a branch name. |
| `osaka-jade` | `https://github.com/basecamp/omarchy` | `themes/osaka-jade/colors.toml` | `dark` | `5e516be5447064352ea8188cba9f13508b04c3c0` | Pin exact commit SHA from Omarchy default branch because the palette is Omarchy-native. |
| `vantablack` | `https://github.com/basecamp/omarchy` | `themes/vantablack/colors.toml` | `dark` | `e1ee8e8561c5c1ccfd953d4cf5e311dd1f810aed` | Pin exact commit SHA from Omarchy `dev` branch because the palette is Omarchy-native. |

## Canonical-Source Selection Rule

1. Default to the original theme upstream repository when that theme has its own maintained palette source.
2. Use Omarchy as canonical only when the theme is Omarchy-native or only published as an Omarchy theme artifact.
3. Each theme must map to one canonical tuple: `repo + file(s) + ref + variant`.
4. Generated artifacts must consume only normalized internal palette keys, not raw upstream key names.

## Normalization Contract (Upstream -> Internal Keys)

Internal keys are fixed: `bg0`, `bg1`, `bg2`, `fg`, `grey`, `red`, `orange`,
`yellow`, `green`, `cyan`, `blue`, `magenta`.

Mapping rules:

- `bg0`: primary background.
- `bg1`: secondary/highlight background.
- `bg2`: tertiary background / dark accent background.
- `fg`: primary foreground.
- `grey`: muted/comment text.
- `cyan`: use upstream `cyan`; if absent, map `aqua`/`teal` to `cyan`.
- `orange`: preserve upstream orange when available; if missing, allow `yellow`
  fallback only with explicit note in source metadata.

## Future Themes: Pinning Rules

1. Required per theme source entry:
   - canonical repo URL
   - canonical file path(s)
   - variant string
   - pinned ref (full commit SHA, optionally with human-friendly tag label)
2. Pins must be immutable (`commit SHA`), not floating (`main`, `master`, or tags without resolved SHA).
3. Pin updates must be explicit PR changes that include:
   - old pin -> new pin
   - short drift summary (palette key changes)
   - confirmation that generated artifacts were regenerated and reviewed
