# Wallpaper Switcher Implementation Plan

**Created:** 2025-12-31
**Status:** ✅ COMPLETED (2025-12-31)
**Feature:** Independent wallpaper cycling with Omarchy-style wallpapers + Raycast keyboard shortcut

---

## Validation Results (2025-12-31)

Three parallel validation agents reviewed this plan. Below are the findings and required corrections.

### ✅ Confirmed Correct

- **Raycast no-view mode** - `"mode": "no-view"` is correct for keyboard-only commands
- **showHUD usage** - Proper API for instant feedback in no-view commands
- **execFile pattern** - Matches existing theme-switcher code, proven working
- **osascript syntax** - Works on macOS Sequoia, supports multiple monitors
- **package.json structure** - All required fields present

### ❌ Corrections Required

| Issue                 | Original Plan               | Correction                                                 |
| --------------------- | --------------------------- | ---------------------------------------------------------- |
| **File sorting**      | `find ... \| sort`          | Use `sort -V` for numeric ordering (1, 2, 10 not 1, 10, 2) |
| **Error suppression** | `osascript ... 2>/dev/null` | Handle errors explicitly, don't suppress                   |
| **State tracking**    | JSON object                 | **Changed to symlink** (matches Omarchy, simpler)          |

### ⚠️ Missing Considerations Added

1. **macOS Permissions (TCC)**: First run may require Automation permission grant
2. **Raycast error handling**: Add try/catch with showHUD for failures
3. **Path resolution**: Use `homedir()` not `~` in TypeScript
4. **Output parsing**: CLI must output parseable format for Raycast to extract "2/4"
5. **Encoding option**: Specify `encoding: "utf-8"` for execFileAsync

---

## Overview

Add independent wallpaper cycling to the dotfiles system, allowing users to cycle through multiple wallpapers per theme without triggering a full theme switch.

### Architecture Decision

| Decision            | Choice                                    | Rationale                                              |
| ------------------- | ----------------------------------------- | ------------------------------------------------------ |
| CLI approach        | New `wallpaper-set` script                | Clean separation from theme-set, single responsibility |
| Raycast integration | Add command to theme-switcher extension   | Keeps theme functionality together                     |
| State tracking      | Symlink `~/.config/current-wallpaper`     | Points to current wallpaper file (Omarchy pattern)     |
| Wallpaper storage   | Per-theme directories with numbered files | Matches Omarchy pattern                                |

### User Requirements (Confirmed)

1. **Wallpaper sources**: Keep original solid-color PNGs + add Omarchy wallpapers in same directory per theme
2. **Cycling behavior**: Sequential wrap-around (1→2→3→1→2→3...)
3. **Wallpapers per theme**: Tokyo Night (4 total: 1 original + 3 Omarchy), Gruvbox (2), Everforest (2)
4. **Keyboard shortcut**: User will configure manually in Raycast UI (Ctrl+Alt+Cmd+Space planned)

---

## File Structure

```
themes/
├── .local/bin/
│   ├── theme-set           # MODIFY: Check for wallpaper directory first
│   └── wallpaper-set       # CREATE: New CLI script
├── wallpapers/
│   ├── tokyo-night/        # CREATE: Directory (replace single file)
│   │   ├── 1-solid.png          # MOVE: Original solid-color wallpaper
│   │   ├── 2-lakeside.png       # DOWNLOAD: Omarchy
│   │   ├── 3-abstract.jpg       # DOWNLOAD: Omarchy
│   │   └── 4-gradient.jpg       # DOWNLOAD: Omarchy
│   ├── gruvbox/            # CREATE: Directory
│   │   ├── 1-solid.png          # MOVE: Original
│   │   └── 2-gruvbox.jpg        # DOWNLOAD: Omarchy
│   ├── everforest/         # CREATE: Directory
│   │   ├── 1-solid.png          # MOVE: Original
│   │   └── 2-everforest.jpg     # DOWNLOAD: Omarchy
│   ├── tokyo-night.png     # DELETE: After moving to directory
│   ├── gruvbox.png         # DELETE: After moving to directory
│   └── everforest.png      # DELETE: After moving to directory

### Wallpaper Naming Convention (REQUIRED)

Files MUST follow this pattern for correct ordering:

```

<number>-<descriptive-name>.<ext>

````

**Examples:**
- ✅ `1-solid.png` → sorts first
- ✅ `2-lakeside.png` → sorts second
- ✅ `10-sunset.jpg` → sorts tenth (not between 1 and 2)
- ❌ `lakeside.png` → sorts unpredictably (no number prefix)
- ❌ `01-solid.png` → works but inconsistent with existing files

**Why:** The script uses `sort -V` (version sort) which handles `1, 2, 10` correctly, but ONLY if files start with a number prefix. Files without numbers will sort alphabetically after numbered files.

**Adding new wallpapers:** Use the next available number. Check existing files first:
```bash
ls themes/wallpapers/tokyo-night/
# 1-solid.png  2-lakeside.png  3-abstract.jpg  4-gradient.jpg
# Next file should be: 5-<name>.<ext>
````

raycast/extensions/theme-switcher/
├── src/
│ ├── switch-theme.tsx # EXISTING
│ └── next-wallpaper.tsx # CREATE: No-view command
└── package.json # MODIFY: Add next-wallpaper command

~/.config/
├── current-theme # EXISTING
└── current-wallpaper # CREATE: Symlink to current wallpaper file

````

---

## CLI Interface

### wallpaper-set

```bash
# Show current status
wallpaper-set
# Output: Current theme: tokyo-night
#         Wallpaper: 2/4 (lakeside.png)

# Cycle to next (wraps around)
wallpaper-set --next    # or -n
# Output:   ✓ Wallpaper: tokyo-night/3-abstract.jpg (3/4)

# Cycle to previous
wallpaper-set --prev    # or -p

# Set specific index (1-based)
wallpaper-set 3

# Random wallpaper
wallpaper-set --random  # or -r
````

### State Tracking (Symlink)

`~/.config/current-wallpaper` → symlink to actual wallpaper file

```bash
# Example:
~/.config/current-wallpaper -> /Users/you/dotfiles/themes/wallpapers/tokyo-night/3-abstract.jpg
```

**How it works (matches Omarchy):**

- Symlink always points to the current wallpaper file
- `readlink` reads current position
- `ln -sfn` updates to new wallpaper
- Theme switch resets to wallpaper 1 (simpler, no per-theme memory)

**Advantages over JSON:**

- No parsing needed - just filesystem operations
- Simpler code, fewer edge cases
- Matches Omarchy's proven pattern

---

## Implementation Steps

### Phase 1: CLI Foundation

- [x] **1.1** Create `themes/.local/bin/wallpaper-set` script
  - Resolve dotfiles path via symlink
  - Read current theme from `~/.config/current-theme`
  - Track current wallpaper via symlink at `~/.config/current-wallpaper`
  - Read current: `readlink ~/.config/current-wallpaper`
  - Write current: `ln -sfn <wallpaper-path> ~/.config/current-wallpaper`
  - List wallpapers using `find ... | sort -V` for correct numeric ordering
  - Apply wallpaper via osascript with proper error handling (not silent suppression)
  - Support `--next`, `--prev`, `--random`, `<index>`, status display
  - Output parseable format: `✓ Wallpaper: <theme>/<file> (N/M)` for Raycast parsing

- [x] **1.2** Test CLI independently
  - `wallpaper-set` shows status
  - `wallpaper-set --next` cycles correctly
  - State file updates properly

### Phase 2: Wallpaper Migration

- [x] **2.1** Create per-theme wallpaper directories

  ```bash
  mkdir -p themes/wallpapers/{tokyo-night,gruvbox,everforest}
  ```

- [x] **2.2** Move original solid-color wallpapers

  ```bash
  mv themes/wallpapers/tokyo-night.png themes/wallpapers/tokyo-night/1-solid.png
  mv themes/wallpapers/gruvbox.png themes/wallpapers/gruvbox/1-solid.png
  mv themes/wallpapers/everforest.png themes/wallpapers/everforest/1-solid.png
  ```

- [x] **2.3** Download Omarchy wallpapers
  - Tokyo Night (3 files):
    - `2-lakeside.png` from `basecamp/omarchy/themes/tokyo-night/backgrounds/1-scenery-pink-lakeside-sunset-lake-landscape-scenic-panorama-7680x3215-144.png`
    - `3-abstract.jpg` from `basecamp/omarchy/themes/tokyo-night/backgrounds/2-Pawel-Czerwinski-Abstract-Purple-Blue.jpg`
    - `4-gradient.jpg` from `basecamp/omarchy/themes/tokyo-night/backgrounds/3-Milad-Fakurian-Abstract-Purple-Blue.jpg`
  - Gruvbox (1 file):
    - `2-gruvbox.jpg` from `basecamp/omarchy/themes/gruvbox/backgrounds/1-grubox.jpg`
  - Everforest (1 file):
    - `2-everforest.jpg` from `basecamp/omarchy/themes/everforest/backgrounds/1-everforest.jpg`

- [x] **2.4** Test wallpaper cycling with new files

### Phase 3: Theme Integration

- [x] **3.1** Modify `theme-set` script (lines ~303-309)
  - Check if `themes/wallpapers/<theme>/` directory exists
  - If yes: set wallpaper to first file (`1-*.png`) and update symlink
  - If no: fall back to legacy `themes/wallpapers/<theme>.png` (backward compat)

- [x] **3.2** Test theme switching
  - On tokyo-night, cycle wallpaper to 3
  - Switch to gruvbox, verify wallpaper is gruvbox's wallpaper 1
  - Switch back to tokyo-night, verify wallpaper resets to 1 (not 3)

### Phase 4: Raycast Extension

- [x] **4.1** Create `raycast/extensions/theme-switcher/src/next-wallpaper.tsx`

  ```typescript
  import { showHUD } from "@raycast/api";
  import { execFile } from "child_process";
  import { promisify } from "util";
  import { homedir } from "os";
  import { join } from "path";

  const execFileAsync = promisify(execFile);
  const WALLPAPER_SET_PATH = join(homedir(), ".local", "bin", "wallpaper-set");

  export default async function Command() {
    try {
      const { stdout } = await execFileAsync(WALLPAPER_SET_PATH, ["--next"], {
        encoding: "utf-8",
      });
      // Parse output: "✓ Wallpaper: tokyo-night/2-lakeside.png (2/4)"
      const match = stdout.match(/\((\d+\/\d+)\)/);
      const status = match ? match[1] : "Updated";
      await showHUD(`Wallpaper ${status}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await showHUD(`❌ ${message}`);
    }
  }
  ```

- [x] **4.2** Update `package.json` to add command

  ```json
  {
    "commands": [
      { "name": "switch-theme", ... },
      {
        "name": "next-wallpaper",
        "title": "Next Wallpaper",
        "description": "Cycle to next wallpaper for current theme",
        "mode": "no-view"
      }
    ]
  }
  ```

- [x] **4.3** Build and test extension

  ```bash
  cd raycast/extensions/theme-switcher
  npm run build
  npm run dev
  ```

- [x] **4.4** User configures keyboard shortcut in Raycast preferences (Ctrl+Alt+Cmd+Space)

### Phase 5: Documentation

- [x] **5.1** Update `themes/README.md`
  - Document `wallpaper-set` CLI usage
  - Document per-theme wallpaper directory structure
  - Document `N-<name>.<ext>` naming convention (REQUIRED for correct ordering)
  - Document how to add new wallpapers

- [x] **5.2** Update `themes/AGENTS.md`
  - Add wallpaper section to "Adding a New Theme" checklist
  - Document wallpaper file naming convention with examples
  - Add warning about files without number prefix

- [x] **5.3** Update main `AGENTS.md`
  - Add `wallpaper-set` to commands section

---

## Data Flow

```
User presses Ctrl+Alt+Cmd+Space
         │
         ▼
┌─────────────────────┐
│ Raycast Extension   │
│ next-wallpaper.tsx  │
│   (no-view mode)    │
└─────────────────────┘
         │ execFile
         ▼
┌─────────────────────┐
│   wallpaper-set     │
│     --next          │
└─────────────────────┘
         │
    ┌────┴────┬─────────────────┐
    ▼         ▼                 ▼
┌────────┐ ┌────────────┐ ┌──────────────┐
│readlink│ │ List files │ │ osascript    │
│symlink │ │ in theme   │ │ set desktop  │
│        │ │ wallpapers │ │ picture      │
└────────┘ └────────────┘ └──────────────┘
    │              │              │
    ▼              ▼              ▼
~/.config/    themes/wallpapers/   All
current-wallpaper tokyo-night/     Desktops
    │              ├── 1-solid.png
    │              ├── 2-lakeside.png
    └──symlink────▶├── 3-abstract.jpg  (current)
                   └── 4-gradient.jpg
```

---

## Edge Cases

| Scenario                                 | Behavior                                                  |
| ---------------------------------------- | --------------------------------------------------------- |
| Theme has no wallpapers directory        | Fall back to `themes/wallpapers/<theme>.png`              |
| Wallpapers directory is empty            | Log warning, skip wallpaper change                        |
| Symlink missing                          | Create pointing to first wallpaper                        |
| Symlink points to deleted file           | Reset to first wallpaper in current theme                 |
| Symlink points to different theme's file | Reset to first wallpaper in current theme                 |
| Index out of range requested             | Clamp to valid range (1 to total)                         |
| **macOS Automation permission denied**   | Show error with instructions to enable in System Settings |

---

## First Run: macOS Permissions

On first run, macOS may prompt for Automation permission. If wallpaper setting fails:

1. Open **System Settings** → **Privacy & Security** → **Automation**
2. Enable **System Events** for your terminal app (Ghostty/iTerm2/Terminal)
3. Re-run `wallpaper-set --next`

The script should detect permission errors and display this guidance rather than silently failing.

---

## Testing Checklist

- [x] `wallpaper-set` shows current status correctly
- [x] `wallpaper-set --next` cycles 1→2→3→4→1
- [x] `wallpaper-set --prev` cycles 4→3→2→1→4
- [x] `wallpaper-set 3` sets specific wallpaper
- [x] Symlink persists across terminal sessions
- [x] Theme switch resets wallpaper to 1 (expected behavior)
- [x] Raycast command executes and shows HUD
- [x] All wallpapers render correctly on desktop
- [x] Works with multiple monitors (osascript sets all desktops)
- [x] Permission error shows helpful message (not silent failure)
- [x] Numeric file sorting works correctly (1, 2, 10 not 1, 10, 2)
- [x] Wallpaper files follow `N-<name>.<ext>` naming convention
- [x] Symlink pointing to deleted file gracefully resets to wallpaper 1

---

## Files Summary

| File                                                       | Action               | Lines (est.) |
| ---------------------------------------------------------- | -------------------- | ------------ |
| `themes/.local/bin/wallpaper-set`                          | Create               | ~70          |
| `themes/.local/bin/theme-set`                              | Modify               | ~15 changed  |
| `themes/wallpapers/tokyo-night/`                           | Create dir + 4 files | -            |
| `themes/wallpapers/gruvbox/`                               | Create dir + 2 files | -            |
| `themes/wallpapers/everforest/`                            | Create dir + 2 files | -            |
| `raycast/extensions/theme-switcher/src/next-wallpaper.tsx` | Create               | ~35          |
| `raycast/extensions/theme-switcher/package.json`           | Modify               | ~10 lines    |
| `themes/README.md`                                         | Modify               | ~30 lines    |
| `themes/AGENTS.md`                                         | Modify               | ~20 lines    |

---

## Omarchy Wallpaper URLs

For downloading:

**Tokyo Night:**

- https://raw.githubusercontent.com/basecamp/omarchy/master/themes/tokyo-night/backgrounds/1-scenery-pink-lakeside-sunset-lake-landscape-scenic-panorama-7680x3215-144.png
- https://raw.githubusercontent.com/basecamp/omarchy/master/themes/tokyo-night/backgrounds/2-Pawel-Czerwinski-Abstract-Purple-Blue.jpg
- https://raw.githubusercontent.com/basecamp/omarchy/master/themes/tokyo-night/backgrounds/3-Milad-Fakurian-Abstract-Purple-Blue.jpg

**Gruvbox:**

- https://raw.githubusercontent.com/basecamp/omarchy/master/themes/gruvbox/backgrounds/1-grubox.jpg

**Everforest:**

- https://raw.githubusercontent.com/basecamp/omarchy/master/themes/everforest/backgrounds/1-everforest.jpg

---

## Future Considerations

- Add more wallpapers per theme from community sources
- Add `--list` flag to show all available wallpapers
- Add wallpaper preview in Raycast (would need view mode)
- Cross-platform support (Linux: use `feh` or `swaybg`)
- Wallpaper auto-rotation on timer
