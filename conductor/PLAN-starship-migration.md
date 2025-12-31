# PLAN: Migrate from Powerlevel10k to Starship

**Created:** 2025-12-31  
**Updated:** 2025-12-31  
**Status:** ✅ COMPLETE (Phase 1, 1b, 2 done; Phase 3 not needed)  
**Branch:** main

---

## Status Summary

| Phase        | Status        | Description                                                |
| ------------ | ------------- | ---------------------------------------------------------- |
| **Phase 1**  | ✅ COMPLETE   | Core swap: p10k removed, starship installed, config exists |
| **Phase 1b** | ✅ COMPLETE   | Runtime migration functions for existing p10k users        |
| **Phase 2**  | ✅ COMPLETE   | User exploration: custom starship.toml configured          |
| **Phase 3**  | ❌ NOT NEEDED | Theme integration unnecessary - see note below             |

### What's Done

- Starship binary in installer (brew/pacman/apt via script)
- Custom `starship.toml` with Omarchy-inspired minimal config
- `.zshrc` updated: `ZSH_THEME=""` + `starship init zsh`
- All p10k files deleted from repo
- Documentation updated across all AGENTS.md/README.md files
- `theme-set` script updated with Starship note

### What's Remaining

- Nothing - plan complete. Phase 3 (theme integration) determined unnecessary.

---

## Overview

Replace Powerlevel10k (p10k) shell prompt with Starship. Phased approach to allow exploration before committing to a specific style.

## Why Starship?

| Aspect         | Powerlevel10k     | Starship                           |
| -------------- | ----------------- | ---------------------------------- |
| Shell support  | Zsh only          | All shells (zsh, bash, fish, etc.) |
| Config format  | Zsh script        | TOML                               |
| Theming        | Complex overrides | Native palette system              |
| Dependencies   | Oh-My-Zsh theme   | Standalone binary                  |
| Cross-platform | Good              | Excellent                          |

**Pain points with p10k:**

- Rainbow preset too busy
- Pure preset too minimal (no icons)
- Theming via zsh variables is awkward

---

## Phased Approach

### Phase 1: Swap p10k → Starship (defaults) ✅ COMPLETE

- [x] Remove p10k installation and configuration
- [x] Install starship via package managers
- [x] Run starship with defaults (custom config created)
- [x] User explores and configures interactively

### Phase 1b: Installer Runtime Migration ✅ COMPLETE

- [x] Add `detect_p10k()` function
- [x] Add `backup_p10k()` function
- [x] Add `clean_zshrc_p10k()` function
- [x] Add `migrate_p10k_to_starship()` function
- [x] Add `setup_starship()` function
- [x] Add `sed_inplace()` helper to utils.sh
- [x] Integrate with `setup_zsh_env()`

### Phase 2: User Exploration ✅ COMPLETE

- [x] Test starship presets (`starship preset --list`)
- [x] Customize `~/.config/starship.toml` manually
- [x] Settle on preferred prompt style (Omarchy-inspired minimal)

### Phase 3: Theme Integration ❌ NOT NEEDED

> **Why not needed**: Starship uses color names (e.g., `cyan`, `green`) which are
> interpreted by the terminal. Since `theme-set` switches Ghostty themes, and
> Ghostty themes define what "cyan" means, starship colors change dynamically
> without any additional work. As long as starship.toml uses color names (not
> hex codes), theming is automatic.

---

## Phase 1 Implementation

### Files to DELETE

| File                                        | Reason              |
| ------------------------------------------- | ------------------- |
| `zsh/.p10k.zsh`                             | Base p10k config    |
| `themes/configs/tokyo-night/p10k-theme.zsh` | P10k theme override |
| `themes/configs/gruvbox/p10k-theme.zsh`     | P10k theme override |
| `themes/configs/everforest/p10k-theme.zsh`  | P10k theme override |

### Files to MODIFY

#### 1. `zsh/.zshrc`

**Remove:**

```zsh
# Lines 1-6: p10k instant prompt block
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

# Line 24: p10k theme
ZSH_THEME="powerlevel10k/powerlevel10k"

# Lines 120-121: p10k source
# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh
```

**Add:**

```zsh
# Line 24: Disable OMZ theme (using Starship)
ZSH_THEME=""

# At end of file: Initialize Starship
eval "$(starship init zsh)"
```

#### 2. `installer/config.sh`

**Add to `TERMINAL_PKGS` array:**

```bash
starship
```

**Add to `get_brew_pkg()`:**

```bash
starship)  echo "starship" ;;
```

**Add to `get_pacman_pkg()`:**

```bash
starship)  echo "starship" ;;
```

**Add to `get_apt_pkg()`:**

```bash
starship)  echo "" ;;  # Use native installer
```

**Add to `get_alt_install_method()`:**

```bash
starship)
    [[ "$DISTRO" == "debian" ]] && echo "native:install_starship_script"
    ;;
```

#### 3. `installer/zsh_setup.sh`

**Remove lines 97-108 (p10k installation):**

```bash
# DELETE: Powerlevel10k theme installation block
local themes_dir="$zsh_custom/themes"
mkdir -p "$themes_dir"

if [[ ! -d "$themes_dir/powerlevel10k" ]]; then
    gum style --foreground "$THEME_SECONDARY" "  Installing Powerlevel10k..."
    if ! git clone --quiet --depth=1 https://github.com/romkatv/powerlevel10k.git "$themes_dir/powerlevel10k"; then
         gum style --foreground "$THEME_ERROR" "  Failed to clone Powerlevel10k"
         return 1
    fi
    changes_made=true
fi
```

**Add function for Debian/Ubuntu:**

```bash
# Install Starship via official script (Debian/Ubuntu)
install_starship_script() {
    curl -sS https://starship.rs/install.sh | sh -s -- -y
}
```

#### 4. `installer/install.sh`

**Add starship installer call (near other native installers):**

```bash
# Add to install_package function's native handler
install_starship_script)
    install_starship_script
    ;;
```

#### 5. `Brewfile`

**Add after stow:**

```ruby
brew "starship"
```

#### 6. `themes/.local/bin/theme-set`

**Comment out or remove p10k section (lines 185-190):**

```bash
# =============================================================================
# 4. P10k - REMOVED (migrated to Starship)
# =============================================================================
# Starship theming will be added in Phase 3
# if [[ -f "$THEMES_DIR/configs/$THEME/starship.toml" ]]; then
#     mkdir -p ~/.config
#     ln -sfn "$THEMES_DIR/configs/$THEME/starship.toml" ~/.config/starship.toml
#     log "Starship"
# fi
```

**Update "To apply changes" message:**

```bash
echo "To apply changes:"
echo "  - Terminal prompt: open a new terminal"
echo "  - Neovim: quit and reopen"
echo "  - OpenCode: restart"
echo ""
echo "Note: Starship prompt not yet themed - configure manually with 'starship config'"
```

### Files to UPDATE (Documentation)

#### 7. `themes/AGENTS.md`

**Update SUPPORTED APPS table:**

- Remove P10k row
- Add note: "Starship: Phase 3 (pending user configuration)"

#### 8. `themes/README.md`

**Update Supported Apps table:**

- Remove P10k row
- Add note about Starship pending integration

#### 9. `README.md` (root)

**Update What's Included:**

```markdown
| `zsh/` | Oh-My-Zsh + Starship prompt |
```

**Update Quick Start - remove p10k clone:**

```bash
# DELETE:
git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ~/.oh-my-zsh/custom/themes/powerlevel10k
```

#### 10. `AGENTS.md` (root)

**Update STRUCTURE:**

```markdown
├── zsh/ # Oh-My-Zsh + Starship prompt
```

---

## Implementation Order

1. [x] **Create branch:** `git checkout -b feat/starship-migration` _(merged to main)_

2. [x] **Add starship to installer** (no breaking changes yet)
   - [x] Modify `installer/config.sh` - starship in TERMINAL_PKGS + all mappings
   - [x] Modify `installer/install.sh` - `install_starship_script()` function added
   - [x] Modify `Brewfile` - `brew "starship"` present

3. [x] **Remove p10k from installer**
   - [x] Modify `installer/zsh_setup.sh` - no p10k code present

4. [x] **Update .zshrc**
   - [x] Modify `zsh/.zshrc` - `ZSH_THEME=""`, `starship init zsh` at end

5. [x] **Update theme-set**
   - [x] Comment out p10k section in `themes/.local/bin/theme-set`
   - [x] Add Starship note to output message

6. [x] **Delete p10k files**
   - [x] Delete `zsh/.p10k.zsh` - file removed
   - [x] Delete `themes/configs/*/p10k-theme.zsh` (3 files) - files removed

7. [x] **Update documentation**
   - [x] Update `themes/AGENTS.md` - Starship note at line 80
   - [x] Update `themes/README.md` - Starship note at line 34
   - [x] Update `README.md` - "Oh-My-Zsh + Starship prompt"
   - [x] Update `AGENTS.md` - "Oh-My-Zsh + Starship"

8. [x] **Test locally**
   - [x] Starship config exists: `starship/.config/starship.toml`
   - [x] Prompt working (user confirmed via current usage)

---

## Installer Runtime Migration

> **STATUS: ✅ IMPLEMENTED**
>
> Functions added to `installer/zsh_setup.sh` and `installer/utils.sh`.

When a user runs the installer on a system that **already has p10k installed**, the installer should detect it and offer to migrate. This section defines the runtime functions added to `installer/zsh_setup.sh`.

### Function Signatures & Return Codes

| Function                     | Status | Return Codes                 | Description                                   |
| ---------------------------- | ------ | ---------------------------- | --------------------------------------------- |
| `detect_p10k()`              | [x]    | 0=found, 1=clean             | Silent detection of any p10k artifacts        |
| `backup_p10k()`              | [x]    | 0=success, 1=failure         | Backup all p10k files to `.backups/`          |
| `clean_zshrc_p10k()`         | [x]    | 0=success, 1=failure         | Remove p10k references from user's `~/.zshrc` |
| `migrate_p10k_to_starship()` | [x]    | 0=success, 1=declined/failed | Main orchestrator with user prompts           |
| `setup_starship()`           | [x]    | 0=success, 1=failure         | Ensure binary installed + stow config         |

### P10k Detection Points

#### Theme Directories (check ALL, any match = detected)

```bash
P10K_THEME_DIRS=(
    "$HOME/.oh-my-zsh/custom/themes/powerlevel10k"  # Oh-My-Zsh install
    "$HOME/powerlevel10k"                            # Manual git clone
    "$HOME/.powerlevel10k"                           # Alternative manual
)
```

#### Homebrew Installation (macOS only)

```bash
brew list powerlevel10k &>/dev/null
```

#### Config File

```bash
"$HOME/.p10k.zsh"
```

#### .zshrc Patterns (regex for grep -E)

```bash
# ZSH_THEME setting
ZSH_THEME=.*powerlevel10k

# Source commands (multiple variations)
source.*powerlevel10k
\. .*powerlevel10k

# p10k config source
source.*\.p10k\.zsh
\[\[ .*\.p10k\.zsh.*\]\].*source

# Instant prompt block
p10k-instant-prompt
```

#### Cache Files

```bash
"${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-"*
"${XDG_CACHE_HOME:-$HOME/.cache}/gitstatus"
```

### Function Logic

#### detect_p10k()

```
FUNCTION detect_p10k()
    # Silent - no output, just return code

    # 1. Check theme directories
    FOR each dir IN P10K_THEME_DIRS:
        IF dir exists: RETURN 0

    # 2. Check homebrew (macOS only)
    IF macOS AND brew list powerlevel10k succeeds: RETURN 0

    # 3. Check config file
    IF ~/.p10k.zsh exists: RETURN 0

    # 4. Check .zshrc for p10k patterns
    IF ~/.zshrc exists:
        IF grep -qE "(ZSH_THEME=.*powerlevel10k|source.*powerlevel10k|p10k-instant-prompt|\.p10k\.zsh)" ~/.zshrc:
            RETURN 0

    # 5. Check cache files
    IF any file matches ~/.cache/p10k-instant-prompt-*: RETURN 0

    RETURN 1  # Clean - no p10k found
```

#### backup_p10k()

```
FUNCTION backup_p10k()
    LOCAL timestamp = $(date +%Y%m%d_%H%M%S)
    LOCAL backup_base = "$DOTFILES_DIR/.backups/p10k-$timestamp"
    LOCAL backed_up = 0

    mkdir -p "$backup_base"

    # 1. Backup ~/.p10k.zsh if exists (and not symlink)
    IF ~/.p10k.zsh exists AND not symlink:
        cp ~/.p10k.zsh "$backup_base/"
        gum style "  Backed up: ~/.p10k.zsh"

    # 2. Backup theme directory (whichever exists)
    FOR each dir IN P10K_THEME_DIRS:
        IF dir exists:
            cp -r "$dir" "$backup_base/$(basename $dir)"
            gum style "  Backed up: $dir"
            BREAK  # Only one should exist

    # 3. Backup ~/.zshrc (always, if not symlink)
    IF ~/.zshrc exists AND not symlink:
        cp ~/.zshrc "$backup_base/.zshrc"
        gum style "  Backed up: ~/.zshrc"

    gum style --success "  Backup complete: $backup_base"
    RETURN 0
```

#### clean_zshrc_p10k()

```
FUNCTION clean_zshrc_p10k()
    LOCAL zshrc="$HOME/.zshrc"

    IF NOT -f "$zshrc": RETURN 0  # Nothing to clean

    # Use cross-platform sed (see helper below)

    # 1. Remove instant prompt block (multi-line)
    sed_inplace '/# Enable Powerlevel10k instant prompt/,/^fi$/d' "$zshrc"

    # 2. Change ZSH_THEME to empty
    sed_inplace 's/^ZSH_THEME=.*powerlevel10k.*/ZSH_THEME=""/' "$zshrc"

    # 3. Remove p10k source lines (all variations)
    sed_inplace '/\[\[.*\.p10k\.zsh.*\]\].*source/d' "$zshrc"
    sed_inplace '/^source.*\.p10k\.zsh/d' "$zshrc"

    # 4. Remove "To customize prompt" comment
    sed_inplace '/# To customize prompt, run.*p10k configure/d' "$zshrc"

    # 5. Remove homebrew source line
    sed_inplace '/source.*powerlevel10k.*\.zsh-theme/d' "$zshrc"

    gum style --success "  Cleaned ~/.zshrc"
    RETURN 0
```

#### migrate_p10k_to_starship()

```
FUNCTION migrate_p10k_to_starship()
    gum style --primary "  ◆ Powerlevel10k detected"

    # 1. Show info box
    gum style --subtext "  ╭─ P10K MIGRATION ─────────────────────────────╮"
    gum style --subtext "  │  Powerlevel10k will be replaced by Starship  │"
    gum style --subtext "  │                                              │"
    gum style --subtext "  │  This will:                                  │"
    gum style --subtext "  │    • Backup all p10k files                   │"
    gum style --subtext "  │    • Remove p10k from ~/.zshrc               │"
    gum style --subtext "  │    • Delete p10k installation                │"
    gum style --subtext "  ╰──────────────────────────────────────────────╯"

    # 2. Prompt user
    IF NOT gum confirm "Migrate from Powerlevel10k to Starship?":
        gum style --subtext "  Skipped - keeping Powerlevel10k"
        RETURN 1

    # 3. Backup first
    IF NOT backup_p10k: RETURN 1

    # 4. Clean .zshrc
    IF NOT clean_zshrc_p10k: RETURN 1

    # 5. Delete p10k files
    FOR each dir IN P10K_THEME_DIRS:
        IF dir exists: rm -rf "$dir"

    rm -f ~/.p10k.zsh
    rm -f ~/.cache/p10k-instant-prompt-* 2>/dev/null
    rm -rf ~/.cache/gitstatus 2>/dev/null

    # 6. Show distro-specific uninstall hint
    IF macOS AND brew list powerlevel10k succeeds:
        gum style --subtext "  ┌─ OPTIONAL ──────────────────────────────────┐"
        gum style --subtext "  │ Uninstall Homebrew package:                 │"
        gum style --subtext "  │   brew uninstall powerlevel10k              │"
        gum style --subtext "  └──────────────────────────────────────────────┘"
    ELIF Arch AND yay/paru has powerlevel10k:
        gum style --subtext "  ┌─ OPTIONAL ──────────────────────────────────┐"
        gum style --subtext "  │ Uninstall AUR package:                      │"
        gum style --subtext "  │   yay -R powerlevel10k-git                  │"
        gum style --subtext "  └──────────────────────────────────────────────┘"

    gum style --success "  Migration complete"
    RETURN 0
```

#### setup_starship()

```
FUNCTION setup_starship()
    gum style --primary "  ◆ Setting up Starship prompt..."

    # 1. Check if binary installed, prompt to install if not
    IF command -v starship exists:
        gum style --subtext "  Starship already installed"
    ELSE:
        gum style --warning "  Starship binary not found"
        IF gum confirm "Install Starship now?":
            install_package "starship"  # Cross-platform: brew/pacman/native
            IF failed: RETURN 1
        ELSE:
            gum style --error "  Starship required for prompt"
            RETURN 1

    # 2. Stow starship config
    IF directory "$DOTFILES_DIR/starship" exists:
        stow_package "starship"
        CASE result:
            0: gum style --success "  Config linked" ;;
            3: gum style --subtext "  Config already linked" ;;
            *: RETURN 1 ;;

    # 3. Verify starship init in .zshrc (for edge cases like Omarchy)
    IF ~/.zshrc exists AND NOT symlink:
        IF NOT grep -q 'starship init zsh' ~/.zshrc:
            echo '' >> ~/.zshrc
            echo '# Initialize Starship prompt' >> ~/.zshrc
            echo 'eval "$(starship init zsh)"' >> ~/.zshrc
            gum style --success "  Added starship init to ~/.zshrc"

    gum style --success "  Starship configured"
    RETURN 0
```

### Cross-Platform sed Helper

> **STATUS: [x] IMPLEMENTED**

Add to `installer/utils.sh`:

```bash
# Cross-platform sed in-place editing
# Usage: sed_inplace 'pattern' file
sed_inplace() {
    if sed --version >/dev/null 2>&1; then
        # GNU sed (Linux)
        sed -i "$@"
    else
        # BSD sed (macOS)
        sed -i '' "$@"
    fi
}
```

### Error Handling Strategy

| Scenario                   | Handling                                |
| -------------------------- | --------------------------------------- |
| Backup fails               | Abort migration, return 1               |
| sed command fails          | Log error, continue (non-fatal)         |
| User declines              | Return 1, keep p10k                     |
| No p10k found              | `detect_p10k` returns 1, skip migration |
| Starship binary missing    | Prompt to install, fail if declined     |
| Partial state (some files) | Process what exists, log what's missing |

### Integration with setup_zsh_env()

> **STATUS: [x] IMPLEMENTED**

Add at end of existing `setup_zsh_env()` function in `installer/zsh_setup.sh`:

```bash
setup_zsh_env() {
    # ... existing code (Oh-My-Zsh, plugins, change_default_shell) ...

    # === P10k Migration + Starship Setup ===

    # Detect and migrate p10k if present
    if detect_p10k; then
        migrate_p10k_to_starship
        # Continue regardless of result - user may decline
    fi

    # Setup starship (ensure binary + stow config)
    setup_starship || true  # Non-fatal if declined

    # Summary (existing)
    # ...
    return 0
}
```

### Runtime Migration Test Scenarios

#### Scenario 1: Fresh Install (No P10k)

```
detect_p10k → returns 1 (clean)
migrate_p10k_to_starship → skipped
setup_starship → prompts if binary missing, stows config
```

#### Scenario 2: P10k via Oh-My-Zsh Theme

```
detect_p10k → finds ~/.oh-my-zsh/custom/themes/powerlevel10k → returns 0
migrate_p10k_to_starship → prompts user
  → backup_p10k → backs up theme dir, .p10k.zsh, .zshrc
  → clean_zshrc_p10k → removes ZSH_THEME, instant prompt, source lines
  → deletes theme dir, config, cache
setup_starship → stows config
```

#### Scenario 3: P10k via Homebrew (macOS)

```
detect_p10k → brew list succeeds → returns 0
migrate_p10k_to_starship → prompts user
  → backs up .p10k.zsh, .zshrc
  → cleans .zshrc
  → deletes config, cache
  → shows "brew uninstall powerlevel10k" hint
setup_starship → stows config
```

#### Scenario 4: User Declines Migration

```
detect_p10k → returns 0
migrate_p10k_to_starship → user selects "No" → returns 1
  → p10k remains untouched
setup_starship → still runs (user may want to try starship alongside)
```

#### Scenario 5: Starship Binary Not Installed

```
detect_p10k → returns 1 (or user migrates)
setup_starship:
  → "Starship binary not found"
  → "Install Starship now?" [Yes/No]
  → Yes: install_package "starship" → stow config
  → No: return 1, error message
```

#### Scenario 6: Already on Starship (Re-run Installer)

```
detect_p10k → returns 1 (no p10k artifacts)
migrate_p10k_to_starship → skipped
setup_starship:
  → "Starship already installed"
  → "Config already linked"
  → returns 0
```

---

## Testing Checklist

### Pre-flight (Phase 1 - VERIFIED)

- [x] Starship installed: `which starship`
- [x] No p10k references in `.zshrc`
- [x] `.p10k.zsh` deleted
- [x] Custom `starship.toml` exists

### Functional (Phase 1 - VERIFIED)

- [x] New terminal shows starship prompt
- [x] Oh-My-Zsh plugins work (autosuggestions, syntax-highlighting)
- [x] Git status shows in prompt (when in git repo)
- [x] Theme switching still works (other apps, not prompt yet)

### Runtime Migration Testing (NOT YET APPLICABLE)

- [ ] Scenario 1: Fresh install (no p10k)
- [ ] Scenario 2: P10k via Oh-My-Zsh theme
- [ ] Scenario 3: P10k via Homebrew
- [ ] Scenario 4: User declines migration
- [ ] Scenario 5: Starship binary not installed
- [ ] Scenario 6: Already on Starship (re-run)

### Exploration commands

```bash
# List available presets
starship preset --list

# Try a preset
starship preset pastel-powerline -o ~/.config/starship.toml

# Edit config directly
starship config

# Validate config
starship config --validate
```

---

## Rollback Strategy

If issues arise:

```bash
# 1. Restore .zshrc
cd ~/dotfiles && git checkout zsh/.zshrc

# 2. Restore .p10k.zsh
git checkout zsh/.p10k.zsh

# 3. Reinstall p10k theme
git clone --depth=1 https://github.com/romkatv/powerlevel10k.git \
    ~/.oh-my-zsh/custom/themes/powerlevel10k

# 4. Re-stow
stow -D zsh && stow zsh

# 5. Restart shell
exec zsh
```

---

## Phase 2: User Exploration (Future)

Once Phase 1 is complete, explore starship:

```bash
# See all presets
starship preset --list

# Popular presets to try:
starship preset pastel-powerline -o ~/.config/starship.toml
starship preset tokyo-night -o ~/.config/starship.toml
starship preset gruvbox-rainbow -o ~/.config/starship.toml
starship preset plain-text-symbols -o ~/.config/starship.toml
starship preset nerd-font-symbols -o ~/.config/starship.toml

# Or start minimal (like Omarchy)
# See: https://github.com/basecamp/omarchy/blob/main/config/starship.toml
```

---

## Phase 3: Theme Integration (Future)

Once you settle on a prompt style:

1. Create base `starship.toml` with your preferred modules/format
2. Create themed versions in `themes/configs/<theme>/starship.toml`
3. Add starship symlink to `theme-set` script
4. Colors to map from existing palettes:
   - Tokyo Night: blue `#7aa2f7`, green `#9ece6a`, red `#f7768e`
   - Gruvbox: orange `#fe8019`, green `#b8bb26`, red `#fb4934`
   - Everforest: green `#a7c080`, blue `#7fbbb3`, red `#e67e80`

---

## Cross-Platform Notes

| Platform      | Installation                                    | Notes                      |
| ------------- | ----------------------------------------------- | -------------------------- |
| macOS         | `brew install starship`                         | Primary target             |
| Arch Linux    | `pacman -S starship`                            | Official repos             |
| Debian/Ubuntu | `curl -sS https://starship.rs/install.sh \| sh` | apt version often outdated |

---

## References

- [Starship Documentation](https://starship.rs/)
- [Starship Presets](https://starship.rs/presets/)
- [Starship Configuration](https://starship.rs/config/)
- [Starship Advanced Config](https://starship.rs/advanced-config/)
- [Omarchy Starship Config](https://github.com/basecamp/omarchy/blob/main/config/starship.toml)

---

## Starship Configuration Reference

> Source: https://starship.rs/config/

### Config File Location

```bash
# Default location
~/.config/starship.toml

# Override with environment variable
export STARSHIP_CONFIG=~/path/to/starship.toml
```

### Basic Structure

```toml
# Schema for editor completions
"$schema" = 'https://starship.rs/config-schema.json'

# Global settings
add_newline = true
command_timeout = 500

# Prompt format (module order)
format = "$directory$git_branch$git_status$character"

# Right-side prompt
right_format = "$cmd_duration$time"

# Activate a named palette
palette = 'tokyo-night'

# Define color palettes
[palettes.tokyo-night]
blue = "#7aa2f7"
green = "#9ece6a"
red = "#f7768e"

# Module configuration
[character]
success_symbol = "[❯](bold green)"
error_symbol = "[✗](bold red)"
```

### Key Modules (P10k Equivalents)

| P10k Segment             | Starship Module            | Example Config                                |
| ------------------------ | -------------------------- | --------------------------------------------- |
| `dir`                    | `directory`                | `[directory]` `truncation_length = 3`         |
| `vcs` (git)              | `git_branch`, `git_status` | `$git_branch$git_status`                      |
| `command_execution_time` | `cmd_duration`             | `[cmd_duration]` `min_time = 2000`            |
| `virtualenv`             | `python`                   | `[python]` `format = "[$virtualenv]($style)"` |
| `status`                 | `character`                | `[character]` success/error symbols           |
| `time`                   | `time`                     | `[time]` `disabled = false`                   |
| `context` (user@host)    | `username`, `hostname`     | `$username$hostname`                          |
| `os_icon`                | `os`                       | `[os]` `disabled = false`                     |
| `kubecontext`            | `kubernetes`               | `[kubernetes]` `disabled = false`             |
| `aws`                    | `aws`                      | `[aws]`                                       |
| `background_jobs`        | `jobs`                     | `[jobs]`                                      |

### Style Strings

```toml
# Format: 'fg:color bg:color modifiers'
style = 'bold green'
style = 'fg:blue bg:black'
style = 'bold italic fg:#7aa2f7'
style = 'underline bg:#1a1b26'

# ANSI 256 colors
style = 'bold fg:27'

# Hex colors
style = 'fg:#7aa2f7'
```

### Format Strings

```toml
# Variables start with $
format = '$directory$git_branch'

# Text groups with styling: [text](style)
format = '[on](red bold) [$branch](italic cyan)'

# Conditional: only shows if variables inside have values
format = '($python )'  # Shows nothing if $python is empty
```

### Color Palettes

```toml
# Define multiple palettes
[palettes.tokyo-night]
bg = "#1a1b26"
blue = "#7aa2f7"
green = "#9ece6a"
red = "#f7768e"

[palettes.gruvbox]
bg = "#1d2021"
orange = "#fe8019"
green = "#b8bb26"
red = "#fb4934"

# Activate one palette
palette = "tokyo-night"

# Use palette colors in modules
[directory]
style = "bold blue"  # Uses palette's blue color
```

### Common Module Examples

#### Directory

```toml
[directory]
truncation_length = 3
truncation_symbol = "…/"
style = "bold cyan"
repo_root_style = "bold blue"
repo_root_format = "[$repo_root]($repo_root_style)[$path]($style) "
```

#### Git Branch

```toml
[git_branch]
format = "[$symbol$branch]($style) "
symbol = " "
style = "bold purple"
```

#### Git Status

```toml
[git_status]
format = '[$all_status$ahead_behind]($style) '
style = "bold red"
ahead = "⇡${count}"
behind = "⇣${count}"
diverged = "⇕⇡${ahead_count}⇣${behind_count}"
untracked = "?${count}"
modified = "!${count}"
staged = "+${count}"
```

#### Character (Prompt Symbol)

```toml
[character]
success_symbol = "[❯](bold green)"
error_symbol = "[❯](bold red)"
# Or different symbols
error_symbol = "[✗](bold red)"
vimcmd_symbol = "[❮](bold green)"
```

#### Command Duration

```toml
[cmd_duration]
min_time = 2000  # Show if command takes >2s
format = "[$duration]($style) "
style = "bold yellow"
```

#### Time

```toml
[time]
disabled = false
format = "[$time]($style) "
time_format = "%H:%M"
style = "bold white"
```

### Omarchy's Minimal Config (Reference)

```toml
add_newline = true
command_timeout = 200
format = "[$directory$git_branch$git_status]($style)$character"

[character]
error_symbol = "[✗](bold cyan)"
success_symbol = "[❯](bold cyan)"

[directory]
truncation_length = 2
truncation_symbol = "…/"
repo_root_style = "bold cyan"
repo_root_format = "[$repo_root]($repo_root_style)[$path]($style)[$read_only]($read_only_style) "

[git_branch]
format = "[$branch]($style) "
style = "italic cyan"

[git_status]
format = '[$all_status]($style)'
style = "cyan"
ahead = "⇡${count} "
diverged = "⇕⇡${ahead_count}⇣${behind_count} "
behind = "⇣${count} "
conflicted = " "
up_to_date = ""
untracked = "? "
modified = " "
stashed = ""
staged = ""
renamed = ""
deleted = ""
```

### Useful Commands

```bash
# List all presets
starship preset --list

# Apply a preset
starship preset tokyo-night -o ~/.config/starship.toml
starship preset gruvbox-rainbow -o ~/.config/starship.toml
starship preset nerd-font-symbols -o ~/.config/starship.toml

# Open config in $EDITOR
starship config

# Validate config syntax
starship config --validate

# Explain current prompt (debug)
starship explain

# Print default config
starship print-config

# Time prompt render (performance)
starship timings
```
