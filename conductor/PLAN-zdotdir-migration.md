# PLAN: ZDOTDIR Migration for Protected Zsh Config

**Status:** Planning (Ready for Phase 1)  
**Created:** 2026-01-02  
**Updated:** 2026-01-02  
**Phase:** 1 of 2

## Executive Summary

Migrate from symlinking `~/.zshrc` directly (gets polluted by external tools) to using `ZDOTDIR` to protect git-tracked config while still allowing external tool additions to work.

## Problem Statement

External tools (nvm, opencode, rustup, pyenv, etc.) append PATH exports to `~/.zshrc`. Since it's a symlink to a git-tracked file, this causes:

1. Uncommitted changes in the dotfiles repo
2. Git pull conflicts when syncing between machines
3. User confusion ("my changes aren't syncing")

## Solution: ZDOTDIR

`ZDOTDIR` is a first-class Zsh feature that tells zsh to look for config files in a different directory. By setting `ZDOTDIR=~/.config/zsh`, our tracked config lives there (protected), while `~/.zshrc` becomes an untracked "sink" for external tools.

### How the Bootstrap Works

1. Zsh starts → ZDOTDIR is unset, so zsh reads `~/.zshenv` from `$HOME`
2. `~/.zshenv` exports `ZDOTDIR=~/.config/zsh`
3. Zsh uses this ZDOTDIR for ALL remaining files (`.zprofile`, `.zshrc`)
4. Result: Config loads from `~/.config/zsh/` in the **same shell invocation**

**After installation:** Run `exec zsh` or open a new terminal. No logout/login required.

### Evidence & Industry Usage

- [Zsh Manual - ZDOTDIR](https://zsh.sourceforge.io/Doc/Release/Parameters.html)
- [Zsh Manual - Startup Files](https://zsh.sourceforge.io/Doc/Release/Files.html)
- [Prezto - ZDOTDIR installation](https://github.com/sorin-ionescu/prezto#installation)
- [Oh-My-Zsh - ZDOTDIR support](https://github.com/ohmyzsh/ohmyzsh/blob/master/tools/install.sh)
- [nicknisi/dotfiles](https://github.com/nicknisi/dotfiles/blob/main/home/.zshenv)
- [LukeSmithxyz/voidrice](https://github.com/LukeSmithxyz/voidrice/blob/master/.config/shell/profile)

---

## Current State

```
dotfiles/
└── zsh/
    ├── .zshrc                    → symlinked to ~/.zshrc (PROBLEM: gets polluted)
    ├── .zprofile                 → symlinked to ~/.zprofile
    └── .oh-my-zsh/
        └── custom/
            ├── aliases.zsh       → symlinked to ~/.oh-my-zsh/custom/aliases.zsh
            └── autoreload.zsh    → symlinked to ~/.oh-my-zsh/custom/autoreload.zsh

Plugins installed by script to: ~/.oh-my-zsh/custom/plugins/
```

## Target State

```
dotfiles/
└── zsh/
    └── .config/
        └── zsh/
            ├── .zshrc            → symlinked to ~/.config/zsh/.zshrc (PROTECTED)
            ├── .zprofile         → symlinked to ~/.config/zsh/.zprofile
            └── custom/
                └── aliases.zsh   → symlinked to ~/.config/zsh/custom/aliases.zsh

~/.zshenv                         → created by installer (NOT symlinked, written directly)
~/.zshrc                          → untracked "sink" for external tools (sourced by tracked config)
~/.zshrc.local                    → machine-specific config (unchanged)
~/.config/zsh/custom/plugins/     → plugins cloned here by installer (not stowed)
```

### Key Design Decisions

1. **No template file for `~/.zshenv`** - Installer writes it directly (only 4 lines, simpler than managing a template)
2. **Delete autoreload.zsh** - Dead code that references Powerlevel10k (we use Starship now)
3. **Migrate old plugins** - Move existing plugins to new location instead of deleting (preserves user-installed plugins)

---

## Implementation Phases

### Phase 1: Structure & Config Changes

**Goal:** Reorganize files and update config without changing installer yet.

#### 1.1 Directory Structure Migration

| Before                                 | After                                |
| -------------------------------------- | ------------------------------------ |
| `zsh/.zshrc`                           | `zsh/.config/zsh/.zshrc`             |
| `zsh/.zprofile`                        | `zsh/.config/zsh/.zprofile`          |
| `zsh/.oh-my-zsh/custom/aliases.zsh`    | `zsh/.config/zsh/custom/aliases.zsh` |
| `zsh/.oh-my-zsh/custom/autoreload.zsh` | **DELETE** (dead code, p10k legacy)  |
| `zsh/.oh-my-zsh/` (directory)          | **DELETE** (empty after moves)       |

#### 1.2 Update `.zshrc` Content

```bash
# === ADD AT TOP (after OS detection) ===

# XDG Base Directory Specification
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
export XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"

# Ensure cache directory exists for zcompdump (one-time creation)
[[ ! -d "$XDG_CACHE_HOME/zsh" ]] && mkdir -p "$XDG_CACHE_HOME/zsh"

# === UPDATE Oh-My-Zsh section ===

# Path to Oh My Zsh installation
export ZSH="$HOME/.oh-my-zsh"

# Custom folder under ZDOTDIR (not default ~/.oh-my-zsh/custom)
export ZSH_CUSTOM="${ZDOTDIR:-$HOME/.config/zsh}/custom"

# Prevent .zcompdump clutter in $HOME
export ZSH_COMPDUMP="$XDG_CACHE_HOME/zsh/zcompdump-${HOST}-${ZSH_VERSION}"

# === ADD BEFORE .zshrc.local sourcing ===

# Source external tool additions (nvm, pyenv, opencode, rustup, etc.)
# These tools append to ~/.zshrc which is NOT tracked.
# We source it here so their additions still work.
#
# Guards:
# - The -ef check prevents self-sourcing if files are the same inode
# - The _STEEZ_SOURCING_HOME_ZSHRC guard prevents infinite loop if ~/.zshrc
#   sources back to us (common during migrations or from old shim setups)
if [[ -f "$HOME/.zshrc" && ! "$HOME/.zshrc" -ef "${ZDOTDIR:-$HOME}/.zshrc" ]]; then
    if (( ! ${+_STEEZ_SOURCING_HOME_ZSHRC} )); then
        typeset -g _STEEZ_SOURCING_HOME_ZSHRC=1
        source "$HOME/.zshrc"
        unset _STEEZ_SOURCING_HOME_ZSHRC
    fi
fi
```

#### 1.3 Update `.zprofile` Content

```bash
# === ADD AT TOP ===

# Ensure ZDOTDIR is set (in case .zshenv didn't run, e.g., some SSH scenarios)
export ZDOTDIR="${ZDOTDIR:-${XDG_CONFIG_HOME:-$HOME/.config}/zsh}"
```

#### 1.4 `~/.zshenv` Bootstrap

**No template file needed.** The installer writes `~/.zshenv` directly (only 4 lines).

Content written by installer:

```bash
# steez-dotfiles-zdotdir - Zsh environment bootstrap
# Sets ZDOTDIR so zsh loads config from ~/.config/zsh/
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
export ZDOTDIR="$XDG_CONFIG_HOME/zsh"
[[ -f "$ZDOTDIR/.zshenv" ]] && source "$ZDOTDIR/.zshenv"
```

---

### Phase 2: Installer Updates

**Goal:** Update installer to handle new structure and migration.

#### 2.1 New Function: `setup_zdotdir()`

```bash
# Sets up ZDOTDIR bootstrap in ~/.zshenv
# Returns: 0 on success, 1 on failure
setup_zdotdir() {
    local zshenv="$HOME/.zshenv"
    local zdotdir="${XDG_CONFIG_HOME:-$HOME/.config}/zsh"
    local marker="# steez-dotfiles-zdotdir"

    # Ensure cache directory exists for zcompdump
    mkdir -p "${XDG_CACHE_HOME:-$HOME/.cache}/zsh"

    # Check if already configured
    if [[ -f "$zshenv" ]] && grep -q "$marker" "$zshenv" 2>/dev/null; then
        gum style --foreground "$THEME_SUBTEXT" "  ZDOTDIR already configured"
        return 0
    fi

    gum style --foreground "$THEME_PRIMARY" "  Setting up ZDOTDIR bootstrap..."

    local bootstrap_content
    bootstrap_content=$(cat << 'EOF'
# steez-dotfiles-zdotdir - Zsh environment bootstrap
# Sets ZDOTDIR so zsh loads config from ~/.config/zsh/
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
export ZDOTDIR="$XDG_CONFIG_HOME/zsh"
[[ -f "$ZDOTDIR/.zshenv" ]] && source "$ZDOTDIR/.zshenv"
EOF
)

    if [[ -f "$zshenv" ]]; then
        # Existing .zshenv - prepend our content
        local existing_content
        existing_content=$(<"$zshenv")
        printf '%s\n\n%s\n' "$bootstrap_content" "$existing_content" > "$zshenv"
        gum style --foreground "$THEME_SUCCESS" "  Updated ~/.zshenv (preserved existing content)"
    else
        # No existing .zshenv - create new
        printf '%s\n' "$bootstrap_content" > "$zshenv"
        gum style --foreground "$THEME_SUCCESS" "  Created ~/.zshenv"
    fi

    return 0
}
```

#### 2.2 New Function: `migrate_zsh_to_zdotdir()`

```bash
# Migrates existing machines from old layout to ZDOTDIR
# Returns: 0 on success/no-op, 1 on failure
migrate_zsh_to_zdotdir() {
    local old_zshrc="$HOME/.zshrc"
    local old_zprofile="$HOME/.zprofile"
    local old_plugins_dir="$HOME/.oh-my-zsh/custom/plugins"
    local zdotdir="${XDG_CONFIG_HOME:-$HOME/.config}/zsh"
    local new_plugins_dir="$zdotdir/custom/plugins"

    # Check if old symlinks exist pointing to dotfiles/zsh/
    if [[ -L "$old_zshrc" ]]; then
        local target
        target=$(readlink "$old_zshrc")
        if [[ "$target" == *"dotfiles/zsh/.zshrc"* ]]; then
            gum style --foreground "$THEME_WARNING" "  Migrating from old zsh layout..."

            # Unstow old zsh package
            stow -D -d "$DOTFILES_DIR" -t "$HOME" zsh 2>/dev/null || true

            # Remove old symlinks explicitly (in case stow missed them)
            [[ -L "$old_zshrc" ]] && rm -f "$old_zshrc"
            [[ -L "$old_zprofile" ]] && rm -f "$old_zprofile"
            [[ -L "$HOME/.oh-my-zsh/custom/aliases.zsh" ]] && rm -f "$HOME/.oh-my-zsh/custom/aliases.zsh"
            [[ -L "$HOME/.oh-my-zsh/custom/autoreload.zsh" ]] && rm -f "$HOME/.oh-my-zsh/custom/autoreload.zsh"

            gum style --foreground "$THEME_SUCCESS" "  Removed old layout symlinks"
        fi
    fi

    # Migrate old plugins directory (preserve user-installed plugins)
    if [[ -d "$old_plugins_dir" ]]; then
        mkdir -p "$new_plugins_dir"

        # Move contents, preserving any user-installed plugins
        if [[ "$(ls -A "$old_plugins_dir" 2>/dev/null)" ]]; then
            gum style --foreground "$THEME_SECONDARY" "  Migrating plugins to new location..."
            for plugin in "$old_plugins_dir"/*/; do
                local plugin_name=$(basename "$plugin")
                if [[ ! -d "$new_plugins_dir/$plugin_name" ]]; then
                    mv "$plugin" "$new_plugins_dir/" 2>/dev/null || true
                    gum style --foreground "$THEME_SUBTEXT" "    Moved: $plugin_name"
                fi
            done
        fi

        # Only remove old dir if empty
        rmdir "$old_plugins_dir" 2>/dev/null || true
        gum style --foreground "$THEME_SUCCESS" "  Plugin migration complete"
    fi

    # If ~/.zshrc exists as a regular file, keep it (external tools sink)
    if [[ -f "$old_zshrc" && ! -L "$old_zshrc" ]]; then
        gum style --foreground "$THEME_SUBTEXT" "  Keeping ~/.zshrc for external tool additions"
    fi

    return 0
}
```

#### 2.3 Update `setup_zsh_env()`

```bash
setup_zsh_env() {
    local zdotdir="${XDG_CONFIG_HOME:-$HOME/.config}/zsh"
    local zsh_custom="$zdotdir/custom"
    local omz_status="OK"
    local plugins_added=0
    local starship_status="OK"

    # 0. Setup ZDOTDIR bootstrap
    setup_zdotdir || return 1

    # 0.5 Migrate from old layout if needed
    migrate_zsh_to_zdotdir || return 1

    # 1. Oh-My-Zsh (still installs to ~/.oh-my-zsh)
    if [[ ! -d "$HOME/.oh-my-zsh" ]]; then
        export ZDOTDIR="$zdotdir"  # Set before OMZ install
        if sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended --keep-zshrc 2>/dev/null; then
            omz_status="Installed"
        else
            post_add "ZSH" "Oh-My-Zsh" "Failed"
            return 1
        fi
    fi
    post_add "ZSH" "Oh-My-Zsh" "$omz_status"

    # 2. Plugins (now under ZDOTDIR/custom/plugins)
    local plugins_dir="$zsh_custom/plugins"
    mkdir -p "$plugins_dir"

    if [[ ! -d "$plugins_dir/zsh-autosuggestions" ]]; then
        if git clone --quiet https://github.com/zsh-users/zsh-autosuggestions "$plugins_dir/zsh-autosuggestions" 2>/dev/null; then
            ((plugins_added++))
        fi
    fi

    if [[ ! -d "$plugins_dir/zsh-syntax-highlighting" ]]; then
        if git clone --quiet https://github.com/zsh-users/zsh-syntax-highlighting "$plugins_dir/zsh-syntax-highlighting" 2>/dev/null; then
            ((plugins_added++))
        fi
    fi

    if [[ $plugins_added -gt 0 ]]; then
        post_add "ZSH" "Plugins" "$plugins_added added"
    else
        post_add "ZSH" "Plugins" "OK"
    fi

    # 3. Starship (unchanged)
    detect_p10k && migrate_p10k_to_starship >/dev/null 2>&1
    if setup_starship "true"; then
        starship_status="OK"
    else
        starship_status="Not configured"
    fi
    post_add "ZSH" "Starship" "$starship_status"

    return 0
}
```

#### 2.4 Update `stow_package()` for zsh

Remove the `.zshrc` backup logic:

```bash
# REMOVE this section from stow_package():
case "$pkg" in
    zsh)
        if ! ensure_backup "$HOME/.zshrc" "zsh"; then
             gum style --foreground "$THEME_ERROR" "Backup cancelled. Skipping $pkg config."
             return 1
        fi
        ;;
esac
```

#### 2.5 Update `setup_starship()`

**DELETE lines 224-230** from `installer/zsh_setup.sh`:

```bash
# DELETE THIS ENTIRE BLOCK - it pollutes ~/.zshrc which we want to keep clean
# The tracked config ($ZDOTDIR/.zshrc) already has starship init built-in
if [[ -f "$HOME/.zshrc" && ! -L "$HOME/.zshrc" ]]; then
    if ! grep -q 'starship init zsh' "$HOME/.zshrc"; then
        echo '' >> "$HOME/.zshrc"
        echo 'eval "$(starship init zsh)"' >> "$HOME/.zshrc"
        [[ "$quiet" != "true" ]] && gum style --foreground "$THEME_SUCCESS" "  Added starship init to ~/.zshrc"
    fi
fi
```

**Why this is safe:** The tracked `.zshrc` already contains:

```bash
if command -v starship >/dev/null 2>&1; then
  eval "$(starship init zsh)"
fi
```

---

## File Changes Summary

| File                                   | Action     | Description                                                          |
| -------------------------------------- | ---------- | -------------------------------------------------------------------- |
| `zsh/.zshrc`                           | **DELETE** | Shim removed - unnecessary complexity                                |
| `zsh/.zprofile`                        | **DELETE** | Shim removed - unnecessary complexity                                |
| `zsh/.oh-my-zsh/custom/aliases.zsh`    | **MOVE**   | → `zsh/.config/zsh/custom/aliases.zsh`                               |
| `zsh/.oh-my-zsh/custom/autoreload.zsh` | **DELETE** | Dead code (p10k legacy, we use Starship)                             |
| `zsh/.oh-my-zsh/`                      | **DELETE** | Empty directory after moves                                          |
| `zsh/.config/zsh/.zshrc`               | **EDIT**   | Add XDG vars, ZSH_CUSTOM, ZSH_COMPDUMP, cache mkdir, source ~/.zshrc |
| `zsh/.config/zsh/.zprofile`            | **EDIT**   | Add ZDOTDIR fallback                                                 |
| `installer/zsh_setup.sh`               | **EDIT**   | Add setup_zdotdir(), migrate_zsh_to_zdotdir() with preflight checks  |
| `installer/install.sh`                 | **EDIT**   | Remove ensure_backup for zsh                                         |
| `AGENTS.md`                            | **EDIT**   | Document new zsh structure                                           |

---

## Compatibility Matrix

| Scenario                            | Behavior                                       |
| ----------------------------------- | ---------------------------------------------- |
| Fresh install                       | Creates `~/.zshenv`, stows to `~/.config/zsh/` |
| Existing machine (old layout)       | Removes old symlinks, creates new structure    |
| External tool appends to `~/.zshrc` | Works - sourced by tracked config              |
| `git pull` with dotfiles changes    | No conflicts - tracked files protected         |
| Oh-My-Zsh                           | Works - uses `ZSH_CUSTOM` under ZDOTDIR        |
| Starship                            | Works - unchanged                              |
| `.zshrc.local`                      | Works - still sourced                          |
| `.secrets`                          | Works - still sourced                          |
| macOS + Linux                       | Works - same structure                         |

---

## Gotchas & Edge Cases

### 1. `~/.zshenv` Runs for ALL Zsh Invocations

Keep it minimal - no interactive commands, no slow operations. Only set ZDOTDIR and XDG vars.

### 2. macOS `/etc/zprofile` and `path_helper`

macOS runs `/etc/zprofile` which calls `path_helper`, potentially reordering PATH. Our `.zprofile` runs after, so final PATH adjustments should go there.

### 3. Existing `~/.zshenv`

If user has custom content, we prepend our ZDOTDIR lines and preserve theirs.

### 4. Circular Source Prevention

Two guards protect against infinite loops when sourcing `~/.zshrc`:

1. **`-ef` check**: Prevents self-sourcing if files are the same inode (symlink case)
2. **`_STEEZ_SOURCING_HOME_ZSHRC` guard**: Prevents mutual recursion if `~/.zshrc` sources back to `$ZDOTDIR/.zshrc`

**Why the guard is needed:** External tools like nvm, rustup, pyenv add `source` commands (not just exports). While these don't create loops themselves, a user might have a migration shim in `~/.zshrc` that sources the tracked config. Without the guard, this causes runaway recursion → shell hang.

**Warning:** `~/.zshrc` should be treated as a "sink" file. It should NOT contain `source "$ZDOTDIR/.zshrc"` or similar.

### 5. Oh-My-Zsh Custom Plugins Migration

Existing machines have plugins in `~/.oh-my-zsh/custom/plugins/`. Migration will:

- **Move** existing plugins to `~/.config/zsh/custom/plugins/` (preserves user-installed plugins)
- **Skip** plugins that already exist in the new location
- **Delete** old directory only if empty after migration

This preserves any user-installed plugins while updating the location.

### 6. SSH/Non-Login Shells

Some SSH configurations may not source `.zshenv`. The fallback in `.zprofile` handles this.

---

## Rollback Plan

If issues arise:

```bash
# 1. Remove ZDOTDIR bootstrap
rm ~/.zshenv

# 2. Unstow new layout
stow -D -d ~/dotfiles -t ~ zsh

# 3. Checkout old structure
git checkout HEAD~1 -- zsh/

# 4. Stow old layout
stow -d ~/dotfiles -t ~ zsh
```

---

## Testing Checklist

### Fresh Install

- [ ] Fresh macOS (Apple Silicon)
- [ ] Fresh macOS (Intel)
- [ ] Fresh Linux Mint
- [ ] Fresh Arch Linux

### Migration

- [ ] Existing macOS with old layout
- [ ] Existing Linux with old layout
- [ ] Machine with existing ~/.zshenv (custom content preserved)

### Functionality

- [ ] Oh-My-Zsh loads correctly
- [ ] Plugins (autosuggestions, syntax-highlighting) work
- [ ] Custom aliases.zsh sourced
- [ ] Starship prompt appears
- [ ] fzf keybindings work
- [ ] zoxide works
- [ ] `.zshrc.local` sourced
- [ ] `.secrets` sourced

### macOS-Specific

- [ ] Starship prompt appears correctly
- [ ] Theme switching works (theme-set command updates prompt)

### External Tools

- [ ] Simulate: `echo "export FOO=bar" >> ~/.zshrc`
- [ ] Verify: `echo $FOO` shows "bar" in new shell
- [ ] `git status` shows no changes in dotfiles repo
- [ ] `git pull` succeeds without conflicts

### Edge Cases

- [ ] Non-interactive shell: `zsh -c 'echo $ZDOTDIR'`
- [ ] SSH login: verify config loads
- [ ] `sudo -i` doesn't break (root has different config)

---

## Resolved Decisions

| Question                    | Decision                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| Old plugins cleanup         | **Move** - Migrate plugins to new location, preserves user-installed plugins                      |
| Template file for ~/.zshenv | **No template** - Installer writes directly (only 4 lines, simpler)                               |
| autoreload.zsh              | **Delete** - Dead code (p10k legacy), Starship doesn't need reload hooks                          |
| Starship init in installer  | **Remove** - Delete lines 224-230, tracked config already has starship init                       |
| Restart requirement         | **exec zsh sufficient** - No logout/login needed, ZDOTDIR takes effect same invocation            |
| Recursion protection        | **Guard variable** - `_STEEZ_SOURCING_HOME_ZSHRC` prevents infinite loop if ~/.zshrc sources back |

---

---

## Plan Validation

**Validated:** 2026-01-02 (Claude + Oracle review)
**Updated:** 2026-01-02 (Simplified - removed shims)

| Aspect                | Status     | Notes                                          |
| --------------------- | ---------- | ---------------------------------------------- |
| Bootstrap approach    | ✅ Correct | ~/.zshenv sets ZDOTDIR for same invocation     |
| XDG compliance        | ✅ Correct | ~/.config/zsh follows spec                     |
| Oh-My-Zsh integration | ✅ Correct | ZSH_CUSTOM + ZSH_COMPDUMP pattern              |
| Plugin migration      | ✅ Fixed   | Now moves instead of deletes                   |
| Starship init         | ✅ Fixed   | Remove append logic from installer             |
| autoreload.zsh        | ✅ Fixed   | Delete dead code                               |
| Cache directory       | ✅ Fixed   | mkdir in .zshrc for robustness                 |
| Recursion protection  | ✅ Fixed   | Added guard variable to prevent infinite loops |
| Race condition fix    | ✅ Fixed   | Re-stow after migration with preflight checks  |
| Shim removal          | ✅ Done    | Deleted zsh/.zshrc and zsh/.zprofile shims     |

### Race Condition Fix Details

The migration function (`migrate_zsh_to_zdotdir`) had a race condition:

1. `stow_package("zsh")` runs first → creates symlinks
2. Migration runs `stow -D zsh` → removes symlinks
3. Shell breaks if nothing re-stows

**Fix applied** (zsh_setup.sh:161-172):

- Added preflight check for DOTFILES_DIR and zsh package existence
- Added `stow --restow` after migration cleanup
- Removed stderr suppression for better error visibility

### Shim Removal Rationale

Originally planned to keep `zsh/.zshrc` and `zsh/.zprofile` as compatibility shims.
**Decided against** because:

- Shims add complexity without benefit for new systems
- Migration function properly handles old → new transition
- Stowing shims to `~/.zshrc` would still allow external tool pollution via symlink

---

## Next Steps

1. ~~Review this plan~~ ✓
2. ~~Address open questions~~ ✓
3. ~~Validate with Oracle~~ ✓
4. **Phase 1**: Implement structure changes (no installer changes)
   - Move files to new directory structure
   - Delete autoreload.zsh (dead code)
   - Update `.zshrc` with new sourcing logic + cache mkdir
   - Update `.zprofile` with ZDOTDIR fallback
5. Test Phase 1 manually on macOS (main machine)
6. **Phase 2**: Implement installer changes
   - Add `setup_zdotdir()` function
   - Add `migrate_zsh_to_zdotdir()` function (with plugin move logic)
   - Update `setup_zsh_env()` with new paths
   - Remove old `.zshrc` backup logic
   - Delete starship append logic (lines 224-230)
7. Test Phase 2 on Linux Mint (via SSH)
8. Full testing across all platforms
9. Update AGENTS.md documentation
