# Dotfiles

## Commands
```sh
# Re-stow edited package
stow --dir="$HOME/Projects/Personal/dotfiles" --target="$HOME" --restow <package>

# Re-stow package that requires no-folding
stow --dir="$HOME/Projects/Personal/dotfiles" --target="$HOME" --restow --no-folding <package>  # nvim | zsh | ghostty

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
