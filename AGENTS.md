# PROJECT KNOWLEDGE BASE

**Generated:** 2025-12-29  
**Commit:** 2046865  
**Branch:** main

## OVERVIEW

macOS/Linux workstation provisioning system. Modular gum-based installer + GNU Stow symlinks + one-command theme switching. NOT a typical dotfiles repo.

## STRUCTURE

```
dotfiles/
├── install.sh          # Main entry - sources installer/*.sh modules
├── installer/          # Modular install logic (bootstrap, config, ui, utils)
├── themes/             # Theme switching: configs + palettes + wallpapers
├── conductor/          # Project planning: plans, specs, archived work
├── raycast/extensions/ # 3 Raycast extensions (prompt-optimizer is complex)
├── sketchybar/         # SketchyBar Lua config + AeroSpace integration
├── nvim/               # LazyVim config (standard)
├── aerospace/          # Tiling WM with home/office/laptop profiles
├── ghostty/            # Terminal config
├── zsh/                # Oh-My-Zsh + Starship
├── karabiner/          # Caps→Escape/Alt
├── borders/            # Window border styling
├── Brewfile            # macOS package manifest
└── git/                # Git config template
```

## WHERE TO LOOK

| Task                     | Location                                | Notes                                                 |
| ------------------------ | --------------------------------------- | ----------------------------------------------------- |
| Add package to installer | `installer/config.sh`                   | Add to `MACOS_PKGS[]` or `TERMINAL_PKGS[]` + mappings |
| Change installer UI      | `installer/ui.sh`                       | gum-based components                                  |
| Add new theme            | `themes/`                               | See `themes/README.md` for structure                  |
| Modify theme-set script  | `themes/.local/bin/theme-set`           | Symlink-based switching                               |
| Edit SketchyBar          | `sketchybar/.config/sketchybar/`        | See CLAUDE.md there                                   |
| Prompt Optimizer work    | `raycast/extensions/prompt-optimizer/`  | See CLAUDE.md there                                   |
| Browser bookmarks ext    | `raycast/extensions/browser-bookmarks/` | Raycast + React                                       |
| Add keybind              | `raycast/extensions/keybinds/`          | Update TSX data array                                 |
| Sync keybinds docs       | `raycast/extensions/keybinds/`          | Also update SketchyBar CLAUDE.md                      |

## COMMANDS

```bash
# Install dotfiles (interactive menu)
./install.sh

# Switch theme (applies to 8 apps)
theme-set tokyo-night    # or gruvbox, everforest
theme-set --next         # cycle

# Stow single package manually
stow -d ~/dotfiles -t ~ <package>

# SketchyBar reload
sketchybar --reload

# Raycast extension dev
cd raycast/extensions/<ext> && npm run dev
```

## CONVENTIONS

- **Stow structure**: `<package>/.config/<app>/` mirrors `~/.config/<app>/`
- **XDG compliance**: Use `~/.config/`, `~/.local/bin/`, `~/.local/share/`
- **Theme files NOT in Stow**: `theme-set` creates symlinks separately
- **No direct config edits**: Use Stow for dotfiles, theme-set for themes
- **Monitor profiles**: Aerospace configs use `skip-worktree` for local edits

## ANTI-PATTERNS (THIS PROJECT)

| Pattern                                     | Why Bad                     | Alternative                       |
| ------------------------------------------- | --------------------------- | --------------------------------- |
| Edit theme files directly                   | Breaks theme switching      | Edit in `themes/configs/<theme>/` |
| Modify `v1-baseline.ts` in prompt-optimizer | **FROZEN** for A/B testing  | Create new strategy file          |
| Manual symlinks for dotfiles                | Stow handles this           | Use `stow <package>`              |
| Skip `--no-folding` for nvim                | Creates plugins/ as symlink | Already handled in installer      |
| Hardcode paths in installer                 | Breaks cross-platform       | Use `safeExec`, `get_*_pkg()`     |

## UNIQUE PATTERNS

### Installer Architecture

```
install.sh
  → installer/bootstrap.sh  # OS detection, gum install
  → installer/config.sh     # Package lists, mappings
  → installer/theme.sh      # Tokyo Night colors
  → installer/ui.sh         # gum menus, spinners
  → installer/install.sh    # Package + stow logic
  → installer/utils.sh      # Backups, conflict detection
  → installer/zsh_setup.sh  # Oh-My-Zsh, plugins
  → installer/git_setup.sh  # Credential helpers
```

### Theme Switching

```bash
theme-set <theme>
  → Load themes/meta/<theme>.env
  → Symlink theme configs to app directories
  → Reload apps (sketchybar --reload, etc.)
  → Update ~/.config/current-theme
```

### Cross-Platform Support

- **macOS**: Homebrew + casks, full feature set
- **Arch Linux**: pacman + yay AUR helper (auto-bootstrap)
- **Debian/Ubuntu**: apt + NodeSource for Node 20+, AppImage for Ghostty

## NOTES

- **Omarchy compatibility**: Installer detects Omarchy and merges configs instead of overwriting
- **Raycast extensions**: Not published to store, local development only
- **Conductor archive**: Old plans preserved in `conductor/archive/`
- **No CI/CD**: Manual builds, `npm run build` per extension
- **Deprecated deps**: Check prompt-optimizer package-lock.json periodically
