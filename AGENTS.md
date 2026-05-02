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
- If keyboard shortcuts change, also update `raycast/extensions/keybinds/src/search-keybinds.tsx`.
- **Do NOT use `--no-folding` for the `claude` package** — stow should fold `~/.claude/skills/` into a directory symlink so new skills created anywhere land directly in the dotfiles repo.


<!-- BEGIN BEADS INTEGRATION v:1 profile:full hash:f65d5d33 -->
## Beads Issue Tracker

This repo uses **bd (beads)** for durable work tracking. Full rules, creation rubric, and command reference auto-load via `bd prime` on session start (Codex `.codex/hooks.json`; pi `beads-prime` extension). Run `bd prime` manually for a refresh.
<!-- END BEADS INTEGRATION -->
