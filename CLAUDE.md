# Dotfiles

## Commands
```sh
# Re-stow a package (simulate first, add --no-folding if target dir has non-stow files)
stow --dir="$HOME/Projects/Personal/dotfiles" --target="$HOME" --simulate --verbose --restow <package>
stow --dir="$HOME/Projects/Personal/dotfiles" --target="$HOME" --restow <package>

# Remove stow symlink safely
unlink <target-path>  # never rm -r on symlinked paths

# Fix monitor ID drift
aerospace list-monitors
# Update monitor IDs in:
# - aerospace/.config/aerospace/aerospace-home.toml
# - sketchybar/.config/sketchybar/settings.lua
aerospace reload-config && sketchybar --reload
```

## Rules
- Edit repo source files, never stow targets in `$HOME`.
- Zsh uses ZDOTDIR (`~/.config/zsh/`) — edit there, not `~/.zshrc`.
- Do not edit files marked `Managed by theme-set`; edit `themes/configs/<theme>/`.
- **MANDATORY**: When ANY keybinding changes in aerospace configs, Ghostty, or app shortcuts, you MUST ALSO update `raycast/extensions/keybinds/src/search-keybinds.tsx` in the SAME edit session — do NOT wait to be asked.
- **MUST use `--no-folding` for the `claude` package** — steez symlinks require `~/.claude/skills/` to be a real directory, not a stow-folded symlink. Skills are managed by `steez` (see `~/Projects/Personal/steez`).


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This repo uses **bd (beads)** for durable work tracking. Full rules, creation rubric, and command reference auto-load via `bd prime` on SessionStart and PreCompact (`.claude/settings.json` hooks). Run `bd prime` manually for a refresh.
<!-- END BEADS INTEGRATION -->
