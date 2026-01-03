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
├── zsh/                # Zsh config (ZDOTDIR-based, see below)
├── karabiner/          # Caps→Escape/Alt
├── borders/            # Window border styling
├── Brewfile            # macOS package manifest
└── git/                # Git config template
```

## WHERE TO LOOK

| Task                     | Location                               | Notes                                                 |
| ------------------------ | -------------------------------------- | ----------------------------------------------------- |
| Add package to installer | `installer/config.sh`                  | Add to `MACOS_PKGS[]` or `TERMINAL_PKGS[]` + mappings |
| Change installer UI      | `installer/ui.sh`                      | gum-based components                                  |
| Add new theme            | `themes/`                              | See `themes/README.md` for structure                  |
| Modify theme-set script  | `themes/.local/bin/theme-set`          | Symlink-based switching                               |
| Edit SketchyBar          | `sketchybar/.config/sketchybar/`       | See CLAUDE.md there                                   |
| Prompt Optimizer work    | `raycast/extensions/prompt-optimizer/` | Separate package, see CLAUDE.md there                 |
| Raycast keybinds ext     | `raycast/extensions/keybinds/`         | Built with raycast package                            |
| Raycast theme-switcher   | `raycast/extensions/theme-switcher/`   | Built with raycast package                            |

## COMMANDS

```bash
# Install dotfiles (interactive menu)
./install.sh

# Switch theme (applies to 8 apps)
theme-set tokyo-night    # or gruvbox, everforest
theme-set --next         # cycle

# Cycle wallpaper (within current theme)
wallpaper-set --next

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

| Pattern                                     | Why Bad                              | Alternative                                 |
| ------------------------------------------- | ------------------------------------ | ------------------------------------------- |
| Edit theme files directly                   | Breaks theme switching               | Edit in `themes/configs/<theme>/`           |
| Modify `v1-baseline.ts` in prompt-optimizer | **FROZEN** for A/B testing           | Create new strategy file                    |
| Manual symlinks for dotfiles                | Stow handles this                    | Use `stow <package>`                        |
| Skip `--no-folding` for nvim/zsh            | Creates directory symlinks into repo | Add to `no_folding_pkgs` array in installer |
| Hardcode paths in installer                 | Breaks cross-platform                | Use `safeExec`, `get_*_pkg()`               |

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
  → installer/zsh_setup.sh  # Oh-My-Zsh, plugins, ZDOTDIR
  → installer/git_setup.sh  # Credential helpers
```

### ZDOTDIR Bootstrap

Zsh config uses `ZDOTDIR` to protect tracked config from external tool pollution (nvm, pyenv, rustup append to `~/.zshrc`).

```
~/.zshenv                          # Bootstrap: sets ZDOTDIR (written by installer, NOT stowed)
~/.config/zsh/.zshrc               # Tracked config (stowed from zsh/.config/zsh/)
~/.config/zsh/.zprofile            # Tracked profile
~/.config/zsh/custom/aliases.zsh   # Tracked aliases
~/.config/zsh/custom/plugins/      # Plugins cloned here by installer
~/.zshrc                           # Untracked "sink" - external tools write here, sourced by tracked config
~/.zshrc.local                     # Machine-specific config (unchanged)
```

**How it works:**

1. Zsh starts → reads `~/.zshenv` (only file zsh reads from `$HOME` by default)
2. `~/.zshenv` exports `ZDOTDIR=~/.config/zsh`
3. Zsh loads `.zprofile`, `.zshrc` from `~/.config/zsh/` (same shell invocation)
4. Tracked `.zshrc` sources `~/.zshrc` to pick up external tool additions

**After install:** Run `exec zsh` or open new terminal. No logout required.

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

## TROUBLESHOOTING

### Monitor Arrangement Changed (AeroSpace + SketchyBar misaligned)

When you rearrange monitors in macOS System Settings, display IDs shift. Both AeroSpace and SketchyBar configs use hardcoded IDs that become stale.

**Symptoms:** Workspaces appear on wrong monitors, switching to workspace 1 focuses wrong display, SketchyBar shows wrong workspaces per monitor.

**Fix (2 minutes):**

1. Get new monitor IDs:

   ```bash
   aerospace list-monitors
   ```

   Output shows: `ID | Monitor Name` (e.g., `1 | VG279QE5A (2)`, `2 | Built-in Retina Display`)

2. Update AeroSpace config (`aerospace/.config/aerospace/aerospace-home.toml`):

   ```toml
   [workspace-to-monitor-force-assignment]
   1 = <MAIN_MONITOR_ID>
   2 = <MAIN_MONITOR_ID>
   ...
   5 = <LEFT_MONITOR_ID>
   ...
   8 = <MACBOOK_ID>
   ```

3. Update SketchyBar map (`sketchybar/.config/sketchybar/settings.lua`):

   ```lua
   map = { [<LEFT_ID>] = 2, [<MACBOOK_ID>] = 3, [<MAIN_ID>] = 1 }
   ```

   This maps AeroSpace monitor IDs → SketchyBar display IDs (1 = main display in macOS).

4. Apply and reload:
   ```bash
   cp ~/Projects/Personal/dotfiles/aerospace/.config/aerospace/aerospace-home.toml ~/.config/aerospace/aerospace.toml
   aerospace reload-config && sketchybar --reload
   ```

**Root cause:** macOS reassigns display IDs unpredictably on arrangement changes. No dynamic solution exists without significant scripting.

## NOTES

- **Omarchy compatibility**: Installer detects Omarchy and merges configs instead of overwriting
- **Raycast extensions**: Not published to store, local development only
- **Conductor archive**: Old plans preserved in `conductor/archive/`
- **No CI/CD**: Manual builds, `npm run build` per extension
- **Deprecated deps**: Check prompt-optimizer package-lock.json periodically
