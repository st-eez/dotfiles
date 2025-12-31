# PLAN: Migrate from Powerlevel10k to Starship

**Created:** 2025-12-31  
**Status:** DRAFT  
**Branch:** TBD

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

### Phase 1: Swap p10k → Starship (defaults)

- Remove p10k installation and configuration
- Install starship via package managers
- Run starship with defaults (no custom config)
- User explores and configures interactively

### Phase 2: User Exploration

- Test starship presets (`starship preset --list`)
- Customize `~/.config/starship.toml` manually
- Settle on preferred prompt style

### Phase 3: Theme Integration (future)

- Create themed `starship.toml` files with color palettes
- Integrate with `theme-set` script
- Match tokyo-night/gruvbox/everforest colors

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

1. **Create branch:** `git checkout -b feat/starship-migration`

2. **Add starship to installer** (no breaking changes yet)
   - Modify `installer/config.sh`
   - Modify `installer/install.sh` (if needed for native installer)
   - Modify `Brewfile`

3. **Remove p10k from installer**
   - Modify `installer/zsh_setup.sh`

4. **Update .zshrc**
   - Modify `zsh/.zshrc`

5. **Update theme-set**
   - Comment out p10k section in `themes/.local/bin/theme-set`

6. **Delete p10k files**
   - Delete `zsh/.p10k.zsh`
   - Delete `themes/configs/*/p10k-theme.zsh` (3 files)

7. **Update documentation**
   - Update `themes/AGENTS.md`
   - Update `themes/README.md`
   - Update `README.md`
   - Update `AGENTS.md`

8. **Test locally**
   - Re-stow zsh: `stow -D zsh && stow zsh`
   - Install starship: `brew install starship`
   - Open new terminal
   - Verify prompt works

---

## Testing Checklist

### Pre-flight

- [ ] Starship installed: `which starship`
- [ ] No p10k references in `.zshrc`
- [ ] `.p10k.zsh` deleted

### Functional

- [ ] New terminal shows starship prompt
- [ ] Oh-My-Zsh plugins work (autosuggestions, syntax-highlighting)
- [ ] Git status shows in prompt (when in git repo)
- [ ] Theme switching still works (other apps, not prompt yet)

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
