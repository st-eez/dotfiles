# Theming System Integration - Implementation Plan

**Created**: 2025-12-29
**Completed**: 2025-12-29
**Status**: COMPLETE
**Previous Plan**: Archived to `archive/theming_integration_20251229/`

## Overview

The modular theming system is 90% complete. `theme-set` works, all configs exist, symlinks function correctly. This plan covers the remaining integration work to make it production-ready.

## Current State

| Component              | Status      | Notes                                     |
| ---------------------- | ----------- | ----------------------------------------- |
| `theme-set` script     | Done        | 228 lines, handles 9 apps                 |
| Theme configs          | Done        | 6 files x 3 themes (18 total)             |
| Symlinks working       | Done        | colors.lua, bordersrc, theme.lua verified |
| P10k source line       | Done        | Lines 1760-1761 in .p10k.zsh              |
| State persistence      | Done        | ~/.config/current-theme                   |
| Stow packages cleaned  | Done        | Theme files removed from stow packages    |
| install.sh integration | **MISSING** | theme-set not called after Stow           |
| DOTFILES path fix      | **MISSING** | Line 14 hardcoded                         |
| stow --no-folding      | **MISSING** | nvim could have symlink conflicts         |
| Backup mechanism       | **MISSING** | No safety before overwrites               |
| Documentation          | **MISSING** | No themes/README.md                       |
| Palette files          | **MISSING** | Only tokyo-night.lua exists               |

---

## Implementation Tasks

### Task 1: Fix DOTFILES Path in theme-set [HIGH]

**Problem**: Line 14 hardcodes `$HOME/Projects/Personal/dotfiles` which breaks for other users.

**File**: `themes/bin/theme-set`
**Line**: 14

**Current**:

```bash
DOTFILES="${DOTFILES:-$HOME/Projects/Personal/dotfiles}"
```

**Change to**:

```bash
# Derive DOTFILES from script location (themes/bin/theme-set -> dotfiles root)
DOTFILES="${DOTFILES:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
```

**Testing**:

```bash
# Verify path resolution without env var
cd ~/Projects/Personal/dotfiles && ./themes/bin/theme-set tokyo-night
ls -la ~/.config/sketchybar/colors.lua  # Should point to correct path

# Verify env var override still works
DOTFILES=/tmp/fake ./themes/bin/theme-set tokyo-night  # Should fail gracefully
```

**Definition of Done**:

- [ ] Script works when cloned to any directory
- [ ] `$DOTFILES` env var still overrides default
- [ ] Symlinks use absolute paths

---

### Task 2: Add --no-folding for nvim Stow [HIGH]

**Problem**: Stow can "fold" directories into symlinks. If `~/.config/nvim/lua/plugins/` becomes a symlink, `theme-set` can't create `theme.lua` inside it.

**File**: `installer/install.sh`
**Location**: Line 852 (stow_package function)

**Current**:

```bash
if stow --dir="$DOTFILES_DIR" --target="$HOME" --restow "$pkg" 2>/dev/null; then
```

**Change to**:

```bash
local stow_opts="--dir=$DOTFILES_DIR --target=$HOME --restow"
[[ "$pkg" == "nvim" ]] && stow_opts="$stow_opts --no-folding"

if stow $stow_opts "$pkg" 2>/dev/null; then
```

**Also update theme-set error message** (line 110):

```bash
warn "  Fix: cd $DOTFILES && stow -D nvim && stow --no-folding nvim"
```

**Definition of Done**:

- [ ] nvim stow uses --no-folding
- [ ] `~/.config/nvim/lua/plugins/` is a real directory
- [ ] theme.lua symlink works

---

### Task 3: Add Theme Setup to install.sh [HIGH]

**Problem**: After Stow, theme-dependent apps have no colors.lua/bordersrc/theme.lua.

**File**: `install.sh`
**Location**: Line 192 (after Git setup, before summary)

**Add**: Theme selection prompt + theme-set call (macOS only)

**Requirements**:

- Only run on macOS
- Prompt user to select theme via gum
- Respect existing ~/.config/current-theme
- Failure should not block installation

**Definition of Done**:

- [ ] Theme setup runs after Stow during install
- [ ] User prompted to select theme (gum choose)
- [ ] Respects existing theme preference
- [ ] Failure doesn't block installation
- [ ] Only runs on macOS

---

### Task 4: Add Backup Mechanism to theme-set [MEDIUM]

**Problem**: theme-set can overwrite user configs without warning.

**File**: `themes/bin/theme-set`

**Add**:

1. `backup_file()` function with timestamped backups
2. Auto-prune: keep only last 5 backup directories
3. Backup before modifying: Obsidian, Antigravity, OpenCode
4. Report backup location at end

**Backup location**: `~/.config/theme-backups/<timestamp>/`

**Definition of Done**:

- [ ] Backups created before modifying JSON configs
- [ ] Only last 5 backup dirs retained
- [ ] Backup location reported to user
- [ ] Symlink operations don't trigger backups

---

### Task 5: Create themes/README.md [MEDIUM]

**File**: `themes/README.md` (new)

**Content**:

- Quick start (theme-set commands)
- Supported apps table
- How to add new themes
- File structure explanation
- Troubleshooting section

**Definition of Done**:

- [ ] README covers all usage scenarios
- [ ] Documents adding new themes
- [ ] Includes troubleshooting

---

### Task 6: Update Main README [MEDIUM]

**File**: `README.md`

**Changes**:

- Update line 13: Add "(switchable)" to theme mention
- Add new "Theming" section after "What's Included"
- Link to themes/README.md

**Definition of Done**:

- [ ] Main README mentions theming
- [ ] Links to themes/README.md
- [ ] Shows available themes

---

### Task 7: Create Missing Palette Files [LOW]

**Files**:

- `themes/palettes/gruvbox.lua`
- `themes/palettes/everforest.lua`

**Purpose**: Reference files for canonical colors (useful for validation and future adjustments)

**Definition of Done**:

- [ ] All 3 palette files exist
- [ ] Colors match official sources
- [ ] Consistent format

---

## Implementation Order

| Order | Task                          | Priority | Est. Time |
| ----- | ----------------------------- | -------- | --------- |
| 1     | Fix DOTFILES path             | HIGH     | 5 min     |
| 2     | Add --no-folding for nvim     | HIGH     | 10 min    |
| 3     | Add theme setup to install.sh | HIGH     | 20 min    |
| 4     | Add backup mechanism          | MEDIUM   | 20 min    |
| 5     | Create themes/README.md       | MEDIUM   | 15 min    |
| 6     | Update main README            | MEDIUM   | 5 min     |
| 7     | Create palette files          | LOW      | 15 min    |

**Total**: ~1.5 hours

---

## Design Decisions

1. **Backup retention**: Keep last 5 backup directories, auto-prune older ones
2. **Theme selection**: Prompt user during install via gum TUI
3. **Linux handling**: Skip theme setup silently (macOS only)
4. **Palette files**: Create for validation and future color adjustments

---

## Files Modified

| File                             | Changes                                                      |
| -------------------------------- | ------------------------------------------------------------ |
| `themes/bin/theme-set`           | Fix DOTFILES path, add backup_file(), improve error messages |
| `installer/install.sh`           | Add --no-folding for nvim stow                               |
| `install.sh`                     | Add theme selection + setup section                          |
| `README.md`                      | Add theming section                                          |
| `themes/README.md`               | New file - documentation                                     |
| `themes/palettes/gruvbox.lua`    | New file - color reference                                   |
| `themes/palettes/everforest.lua` | New file - color reference                                   |
