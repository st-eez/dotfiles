# Dotfiles

GNU Stow-managed dotfiles. Each top-level directory is a stow package mirroring `$HOME`.

## Rules

- Never modify stow symlink targets directly — edit the source in this repo
- Packages `nvim`, `zsh`, `claude` require `--no-folding` when stowing
- Any keyboard shortcut changes must also update: `raycast/extensions/keybinds/src/search-keybinds.tsx`

## Post-Stow Manual Steps

Claude Code doesn't follow symlinks for slash commands, so after stowing `claude`:
```bash
mkdir -p ~/.claude/commands && cp claude/.claude/commands/*.md ~/.claude/commands/
```

## Anti-Patterns

- Don't edit theme files directly — edit in `themes/configs/<theme>/`
- Don't use manual symlinks — Stow handles this
- Zsh uses ZDOTDIR (`~/.config/zsh/`) — edit there, not `~/.zshrc`
- Stow symlinks: use `unlink` to remove, never `rm -r` (follows symlinks and deletes source files)
- Manual stow: always pass `--target=$HOME` — default target is `..`, not `$HOME`

## Monitor Troubleshooting

When macOS monitor arrangement changes, display IDs shift and AeroSpace + SketchyBar break.

**Fix:** Run `aerospace list-monitors` for new IDs, then update:
- `aerospace/.config/aerospace/aerospace-home.toml` — workspace-to-monitor assignments
- `sketchybar/.config/sketchybar/settings.lua` — AeroSpace monitor ID → SketchyBar display ID map

Then: `aerospace reload-config && sketchybar --reload`
