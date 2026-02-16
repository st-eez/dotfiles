# Dotfiles

GNU Stow-managed dotfiles. Each top-level directory is a stow package mirroring `$HOME`.

## Rules

- Never modify stow symlink targets directly — edit the source in this repo
- Packages `nvim`, `zsh`, `claude` require `--no-folding` when stowing
- Any keyboard shortcut changes must also update: `raycast/extensions/keybinds/src/search-keybinds.tsx`

## Anti-Patterns

- Don't edit theme files directly — edit in `themes/configs/<theme>/`
- Don't use manual symlinks — Stow handles this
- Zsh uses ZDOTDIR (`~/.config/zsh/`) — edit there, not `~/.zshrc`

## Monitor Troubleshooting

When macOS monitor arrangement changes, display IDs shift and AeroSpace + SketchyBar break.

**Fix:** Run `aerospace list-monitors` for new IDs, then update:
- `aerospace/.config/aerospace/aerospace-home.toml` — workspace-to-monitor assignments
- `sketchybar/.config/sketchybar/settings.lua` — AeroSpace monitor ID → SketchyBar display ID map

Then: `aerospace reload-config && sketchybar --reload`

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
