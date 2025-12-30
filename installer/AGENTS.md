# INSTALLER AGENTS.md

## OVERVIEW

Modular, multi-distro bash installer system utilizing Charm `gum` for a terminal neo-noir TUI.

## WHERE TO LOOK

| Module         | Responsibility               | Key Functions                                             |
| :------------- | :--------------------------- | :-------------------------------------------------------- |
| `bootstrap.sh` | OS detection & gum bootstrap | `detect_os`, `install_gum`, `detect_omarchy`              |
| `config.sh`    | Package lists & OS mappings  | `get_brew_pkg`, `get_pacman_pkg`, `get_apt_pkg`           |
| `theme.sh`     | Design tokens                | Tokyo Night color variables ($THEME_PRIMARY, etc.)        |
| `logging.sh`   | Styled output                | `log_section`, `log_success`, `log_failure`               |
| `ui.sh`        | gum-based TUI components     | `ui_splash`, `ui_main_menu`, `ui_select_packages`         |
| `install.sh`   | Core installation logic      | `install_package`, `stow_package`, `bootstrap_aur_helper` |
| `utils.sh`     | Conflict & backup system     | `backup_conflicts`, `ensure_backup`                       |
| `zsh_setup.sh` | Shell environment            | `setup_zsh_env` (OMZ + Plugins)                           |
| `git_setup.sh` | Git provisioning             | `setup_git_config` (Template + Cred Helpers)              |

## MODULE DEPENDENCIES

- Root `install.sh` acts as the orchestrator, sourcing all modules in order.
- `ui.sh` ⮕ `logging.sh` ⮕ `theme.sh` (UI stack).
- `install.sh` ⮕ `bootstrap.sh`, `config.sh`, `ui.sh`, `utils.sh` (Core logic dependencies).
- `utils.sh` ⮕ `theme.sh` (Backup UI styling).
- `zsh_setup.sh` / `git_setup.sh` ⮕ Independent post-install modules.

## CONVENTIONS

- **Strict Mode**: All modules assume `set -uo pipefail` (inherited from root `install.sh`).
- **Mapping Helpers**: Use `get_*_pkg()` in `config.sh` for distro-specific package names.
- **Binary Verification**: Always use `get_binary_name()` to check for existing PATH entries.
- **TUI Geometry**: 48-char internal width for all `gum style` boxes; rounded corners (`╭╮╰╯`).
- **Atomic Operations**: Backup conflicts to `DOTFILES_DIR/.backups/TIMESTAMP/` before stowing.
- **Cross-Distro**: Explicit support logic for macOS (Brew), Arch (Pacman/Yay), Debian (Apt).
- **Graceful Cleanup**: Traps in root `install.sh` handle cursor restoration and cleanup on interrupt.

## ANTI-PATTERNS

- **Directory Traversal**: Avoid `cd && command`; use `(cd ... && command)` or absolute paths.
- **Blind Spinners**: Never `gum spin` a command that might prompt for sudo without `sudo -v` first.
- **Path Hardcoding**: Don't hardcode `~/.local/bin`; use `$HOME/.local/bin` and check existence.
- **Silent Failures**: Always verify installation success via `is_installed` after a `gum spin` operation.
- **Theme Bypass**: Don't use raw ANSI codes; use color variables from `theme.sh`.
- **Global Pollution**: Avoid defining non-prefixed global variables outside of `bootstrap.sh`.
