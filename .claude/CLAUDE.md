# Dotfiles

GNU Stow-managed dotfiles. Each top-level directory is a stow package mirroring `$HOME`.

## Structure

- `<package>/.config/<app>/` — stowed to `~/.config/<app>/`
- `<package>/.local/bin/` — stowed to `~/.local/bin/`
- `installer/` — modular install system (`install.sh` entry point)
- `themes/` — theme switcher; `theme-set` script manages per-app symlinks + wallpapers
- `claude/` — stow package for `~/.claude/` (global user config); not the same as `dotfiles/.claude/` (this project's local config)

## Rules

- Never modify stow symlink targets directly — edit the source in this repo
- Use `stow --no --verbose=2` (dry run) before restowing to check conflicts
- Packages `nvim`, `zsh`, `claude` require `--no-folding` when stowing
- `.stow-local-ignore` files control what gets excluded from stowing
- Theme configs live in `themes/configs/<theme>/` — `theme-set` symlinks them into place
