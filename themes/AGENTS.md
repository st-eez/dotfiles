# THEME SYSTEM AGENTS

## OVERVIEW

The theme system is source-driven:

- Edit canonical files in `themes/sources/<theme-id>.toml`.
- Generate artifacts into `themes/meta/`, `themes/configs/`, `themes/themes.json`, `themes/wallpapers/<theme-id>/1-solid.png`, and `pi/.pi/agent/themes/`.
- `theme-set` consumes generated artifacts and updates runtime files/symlinks.

Generated artifacts are not hand-edited.

## COMMANDS

```bash
DOTFILES="$HOME/Projects/Personal/dotfiles"

# Show current theme and available options
theme-set

# Switch/cycle themes
theme-set tokyo-night
theme-set gruvbox
theme-set everforest
theme-set --next    # or -n
theme-set --prev    # or -p

# Wallpaper cycling
wallpaper-set
wallpaper-set --next    # or -n
wallpaper-set --prev    # or -p
wallpaper-set --random  # or -r
wallpaper-set 3

# Validate canonical sources
python3 "$DOTFILES/themes/scripts/theme_build.py" --check

# Regenerate all managed artifacts
python3 "$DOTFILES/themes/scripts/theme_build.py" --generate-meta
python3 "$DOTFILES/themes/scripts/theme_build.py" --generate-themes-json
python3 "$DOTFILES/themes/scripts/theme_build.py" --generate-configs
python3 "$DOTFILES/themes/scripts/theme_build.py" --generate-wallpapers
python3 "$DOTFILES/themes/scripts/theme_build.py" --generate-pi-themes

# Guardrail: fail if generated outputs drift after regeneration
git diff --exit-code -- "$DOTFILES/themes/meta" "$DOTFILES/themes/themes.json" "$DOTFILES/themes/configs" "$DOTFILES/themes/wallpapers" "$DOTFILES/pi/.pi/agent/themes"
```

## DRIFT-PREVENTION WORKFLOW

1. Edit only canonical source files in `themes/sources/` (and optional wallpaper assets `2-*`, `3-*`, etc.).
2. Run `theme_build.py --check`.
3. Regenerate all artifacts (`--generate-meta`, `--generate-themes-json`, `--generate-configs`, `--generate-wallpapers`, `--generate-pi-themes`).
4. Run `python3 -m unittest "$HOME/Projects/Personal/dotfiles/themes/tests/test_theme_build.py"`.
5. Run scoped drift check:
   `git diff --exit-code -- "$HOME/Projects/Personal/dotfiles/themes/meta" "$HOME/Projects/Personal/dotfiles/themes/themes.json" "$HOME/Projects/Personal/dotfiles/themes/configs" "$HOME/Projects/Personal/dotfiles/themes/wallpapers" "$HOME/Projects/Personal/dotfiles/pi/.pi/agent/themes"`.
6. Smoke test runtime behavior with `theme-set <theme-id>`.

## RAYCAST INTEGRATION

The Theme Switcher Raycast extension reads `themes/themes.json` at runtime.
Do not edit extension code for normal theme additions; edit source TOML and regenerate `themes/themes.json`.

## WHERE TO LOOK

| Task | Location |
| --- | --- |
| Canonical source schema | `sources/SCHEMA.md` |
| Canonical source files | `sources/<theme-id>.toml` |
| Upstream pinning records | `sources/CANONICAL_UPSTREAMS.md` |
| Ownership boundaries | `sources/MIGRATION_MAPPING.md` |
| Generator/validator logic | `scripts/theme_build.py` |
| Generator tests | `tests/test_theme_build.py` |
| Theme switch runtime | `.local/bin/theme-set` |
| Wallpaper runtime | `.local/bin/wallpaper-set` |
| Generated metadata | `meta/<theme-id>.env` |
| Generated app configs | `configs/<theme-id>/` |
| Generated Raycast manifest | `themes.json` |
| Runtime state file | `~/.config/current-theme` |
| Runtime backups | `~/.config/theme-backups/` |

## SUPPORTED APPS (9 TOTAL)

| App | Config Method | Reload | Manual Action |
| --- | --- | --- | --- |
| SketchyBar | Symlink `colors.lua` | Auto (`--reload`) | None |
| Ghostty | Symlink `theme.conf` | Auto (SIGUSR2) | None |
| Borders | Symlink `bordersrc` | Auto (script exec) | None |
| Tmux | Symlink `theme.conf` | Auto (`tmux source-file`) | None |
| Wallpaper | osascript | Auto | None |
| Antigravity | JSON edit | Auto (watched) | None |
| Obsidian | JSON edit + CSS copy | Auto (watched) | None |
| Neovim | Symlink `theme.lua` | Manual | Quit/reopen |
| OpenCode | JSON edit | Manual | Restart |
| Pi | Stowed `~/.pi/agent/themes/*.json` | Manual | Restart or `/settings` |

## ADDING A NEW THEME

1. Create `themes/sources/<theme-id>.toml` that matches `themes/sources/SCHEMA.md`.
2. Add optional wallpaper assets in `themes/wallpapers/<theme-id>/` as `2-*.png|jpg` and higher.
3. Run all generators:
   - `python3 "$HOME/Projects/Personal/dotfiles/themes/scripts/theme_build.py" --generate-meta`
   - `python3 "$HOME/Projects/Personal/dotfiles/themes/scripts/theme_build.py" --generate-themes-json`
   - `python3 "$HOME/Projects/Personal/dotfiles/themes/scripts/theme_build.py" --generate-configs`
   - `python3 "$HOME/Projects/Personal/dotfiles/themes/scripts/theme_build.py" --generate-wallpapers`
   - `python3 "$HOME/Projects/Personal/dotfiles/themes/scripts/theme_build.py" --generate-pi-themes`
4. Validate:
   - `python3 "$HOME/Projects/Personal/dotfiles/themes/scripts/theme_build.py" --check`
   - `python3 -m unittest "$HOME/Projects/Personal/dotfiles/themes/tests/test_theme_build.py"`
5. Smoke test:
   - `theme-set <theme-id>`
   - `cat ~/.config/current-theme`
   - `ls -la ~/.config/sketchybar/colors.lua`
   - `ls -la ~/.config/nvim/lua/plugins/theme.lua`

## FILE OWNERSHIP

| Family | Location | Ownership |
| --- | --- | --- |
| Canonical sources | `themes/sources/*.toml` | Source-owned (edit directly) |
| Generated metadata | `themes/meta/*.env` | Generated-owned (no manual edits) |
| Generated configs | `themes/configs/<theme-id>/*` | Generated-owned (no manual edits) |
| Generated manifest | `themes/themes.json` | Generated-owned (no manual edits) |
| Generated wallpaper | `themes/wallpapers/<theme-id>/1-solid.png` | Generated-owned (no manual edits) |
| Generated Pi themes | `pi/.pi/agent/themes/*.json` | Generated-owned (no manual edits) |
| Optional wallpapers | `themes/wallpapers/<theme-id>/2-*` and higher | Source-owned assets |
| Runtime files | `$HOME/.config/*` + app settings files | Runtime-owned (updated by `theme-set`) |

## ANTI-PATTERNS

| Pattern | Why Bad | Alternative |
| --- | --- | --- |
| Editing `themes/meta/*.env` directly | Overwritten by generator | Edit `themes/sources/<theme-id>.toml` and regenerate |
| Editing `themes/configs/<theme-id>/*` directly | Overwritten by generator | Edit `themes/sources/<theme-id>.toml` and regenerate |
| Editing `themes/themes.json` directly | Overwritten by generator | Edit source TOML and run `--generate-themes-json` |
| Editing `themes/wallpapers/<theme-id>/1-solid.png` manually | Overwritten by generator | Change `palette.bg0` in source TOML and regenerate |
| Direct edits to `~/.config/<app>/...` for theme values | Runtime drift and overwritten symlinks | Regenerate artifacts and run `theme-set` |

## TROUBLESHOOTING

```bash
DOTFILES="$HOME/Projects/Personal/dotfiles"

# Missing generated artifacts / theme-set complains about manifest
python3 "$DOTFILES/themes/scripts/theme_build.py" --generate-meta
python3 "$DOTFILES/themes/scripts/theme_build.py" --generate-themes-json
python3 "$DOTFILES/themes/scripts/theme_build.py" --generate-configs
python3 "$DOTFILES/themes/scripts/theme_build.py" --generate-wallpapers

# "plugins/ is a symlink" error
cd "$DOTFILES" && stow -D nvim && stow --no-folding nvim

# Verify active theme and symlink targets
cat ~/.config/current-theme
ls -la ~/.config/sketchybar/colors.lua
ls -la ~/.config/ghostty/theme.conf
ls -la ~/.config/borders/bordersrc
ls -la ~/.config/tmux/theme.conf
ls -la ~/.config/nvim/lua/plugins/theme.lua

# Force app reloads if needed
sketchybar --reload
killall -SIGUSR2 ghostty
```
