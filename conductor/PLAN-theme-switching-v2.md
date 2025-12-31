# Theme Switching v2 - Implementation Plan

**Created**: 2025-12-30
**Status**: PLANNING
**Platform**: macOS only

## Overview

Enhance the existing theme-set CLI with a Raycast extension for visual theme switching and add scripting/automation flags to the CLI.

### What Exists (v1)

- `theme-set` CLI (321 lines bash, `themes/.local/bin/theme-set`)
- 9 apps: SketchyBar, Ghostty, Borders, P10k, Neovim, Obsidian, Antigravity, OpenCode, Wallpaper
- 3 themes: tokyo-night, gruvbox, everforest
- Theme metadata in `themes/meta/<theme>.env` with color variables
- Symlink-based switching + JSON mutation for some apps

### What We're Adding (v2)

**Phase 1: Raycast Extension**

- Visual grid with color palette swatches per theme
- One-click theme switching
- Current theme indicator

**Phase 2: CLI Improvements**

- `--json` flag for scripting/automation
- `--dry-run` flag to preview changes

---

## Current State Analysis

### Theme Metadata Structure

Each `.env` file contains these color variables:

```bash
THEME_NAME="Tokyo Night"
BG_COLOR="#1a1b26"
BLUE="#7aa2f7"
MAGENTA="#bb9af7"
CYAN="#7dcfff"
GREEN="#9ece6a"
RED="#f7768e"
ORANGE="#ff9e64"
YELLOW="#e0af68"
```

### Existing Raycast Extension Patterns

From `keybinds` extension:

- Package.json with `@raycast/api` ^1.103.6 and `@raycast/utils` ^1.17.0
- Single source file pattern (`src/search-keybinds.tsx`)
- Local data arrays (not fetched)
- `List` component with sections and filtering

### Raycast Grid API (for color swatches)

```tsx
<Grid.Item content={{ color: "#hexcode" }} title="Color Name" />
```

### Shell Execution from Raycast

```tsx
import { useExec } from "@raycast/utils";
const { isLoading, data } = useExec("theme-set", ["tokyo-night"]);
```

---

## Architecture Decisions

1. **Extension location**: `raycast/extensions/theme-switcher/`
2. **Data source**: JSON manifest (`themes/themes.json`) - clean Node.js parsing
3. **Command execution**:
   - `useExec` hook for reading current theme (reactive, handles loading state)
   - Promisified `exec` for switch action (one-off, not reactive)
4. **UI component**: `Grid` with color swatches (not `List`)
5. **macOS only**: Match existing theme system constraint
6. **No hooks system**: Direct CLI call, reload apps from theme-set
7. **Separation of concerns**:
   - `.env` files → bash/CLI (`theme-set` script)
   - `themes.json` → Node.js/Raycast extension
8. **Color selection**: 6 curated colors per theme representing its character:
   - Tokyo Night: cool (blue, magenta, cyan)
   - Gruvbox: warm (orange, yellow, aqua)
   - Everforest: nature (green, aqua, blue)

---

## Phase 1: Raycast Extension [~2 hours]

### Task 1.0: Scaffold Extension via Raycast (MANUAL)

**Owner**: User (manual step)

**Steps**:

1. Open Raycast
2. Search "Create Extension"
3. Fill in form:
   - Name: `theme-switcher`
   - Title: `Theme Switcher`
   - Template: Grid (or Empty)
   - Location: Default (`~/Developer/`)
4. Let Raycast create the project

**Output**: Extension scaffolded at `~/Developer/theme-switcher/`

**Definition of Done**:

- [ ] Extension created via Raycast "Create Extension"
- [ ] Folder exists at `~/Developer/theme-switcher/`

---

### Task 1.1: Move Extension to Dotfiles & Update package.json

**Owner**: Agent

**Steps**:

1. Move `~/Developer/theme-switcher/` to `raycast/extensions/theme-switcher/`
2. Update package.json with correct metadata (author, platforms, description)
3. Run `npm install` to verify setup
4. Run `npm run dev` to verify extension loads

**Files to modify**:

- `package.json` - Update metadata

**Definition of Done**:

- [ ] Extension moved to `raycast/extensions/theme-switcher/`
- [ ] package.json updated with correct author, platforms, description
- [ ] `npm install` succeeds
- [ ] `npm run dev` loads extension in Raycast

---

### Task 1.2: Create themes.json Manifest

**File**: `themes/themes.json` (new file - theme data for Raycast)

```json
{
  "themes": [
    {
      "id": "tokyo-night",
      "name": "Tokyo Night",
      "colors": [
        "#1a1b26",
        "#7aa2f7",
        "#bb9af7",
        "#7dcfff",
        "#9ece6a",
        "#f7768e"
      ]
    },
    {
      "id": "gruvbox",
      "name": "Gruvbox Dark Hard",
      "colors": [
        "#1d2021",
        "#fe8019",
        "#fabd2f",
        "#8ec07c",
        "#b8bb26",
        "#fb4934"
      ]
    },
    {
      "id": "everforest",
      "name": "Everforest Dark",
      "colors": [
        "#2d353b",
        "#a7c080",
        "#83c092",
        "#7fbbb3",
        "#dbbc7f",
        "#e67e80"
      ]
    }
  ]
}
```

**Color order**: `[bg, primary, secondary, accent, success, error]`

Each theme's colors are curated to represent its character:

- **Tokyo Night**: bg, blue, magenta, cyan, green, red (cool tones)
- **Gruvbox**: bg, orange, yellow, aqua, green, red (warm tones)
- **Everforest**: bg, green, aqua, blue, yellow, red (nature tones)

**src/themes.ts** (theme loader):

```tsx
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export type Theme = {
  id: string;
  name: string;
  colors: string[]; // Array of 6 hex colors
};

type ThemesManifest = {
  themes: Theme[];
};

/**
 * Load themes from JSON manifest
 */
export function loadThemes(): Theme[] {
  const dotfiles = process.env.DOTFILES || join(homedir(), "dotfiles");
  const manifestPath = join(dotfiles, "themes", "themes.json");

  try {
    const content = readFileSync(manifestPath, "utf-8");
    const manifest: ThemesManifest = JSON.parse(content);
    return manifest.themes.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Failed to load themes.json:", error);
    // Fallback to empty array - extension will show error state
    return [];
  }
}
```

**Why JSON manifest**:

- Clean Node.js parsing (`JSON.parse()` - no regex hacks)
- Separation of concerns: `.env` for CLI, `.json` for Raycast
- Curated colors: Explicitly choose which 6 colors represent each theme
- Easy to maintain: Adding a theme = add JSON object

**Workflow when adding a new theme**:

1. Create `themes/meta/<name>.env` (for CLI)
2. Create `themes/configs/<name>/*` (app configs)
3. Add entry to `themes/themes.json` (for Raycast)

**Definition of Done**:

- [ ] `themes/themes.json` created with all 3 themes
- [ ] `src/themes.ts` created with `loadThemes()` function
- [ ] Each theme has 6 curated colors representing its palette
- [ ] Colors ordered: bg, primary, secondary, accent, success, error

---

### Task 1.3: Implement Grid UI with Color Swatches

**Design**:

- Each theme = one Grid.Section
- 6 Grid.Items per section (color swatches)
- Section title = theme name + "(Current)" indicator
- Action: Set Theme

**src/switch-theme.tsx**:

```tsx
import {
  Grid,
  ActionPanel,
  Action,
  showToast,
  Toast,
  Icon,
} from "@raycast/api";
import { useExec } from "@raycast/utils";
import { exec } from "child_process";
import { promisify } from "util";
import { useMemo, useState } from "react";
import { loadThemes } from "./themes";

const execAsync = promisify(exec);

// Color display labels (matches order in themes.json)
const COLOR_LABELS = [
  "Background",
  "Primary",
  "Secondary",
  "Accent",
  "Success",
  "Error",
];

export default function Command() {
  // Load themes from JSON manifest (memoized)
  const themes = useMemo(() => loadThemes(), []);

  // Read current theme using useExec (Raycast best practice)
  const {
    isLoading,
    data: currentThemeRaw,
    revalidate,
  } = useExec("cat", [process.env.HOME + "/.config/current-theme"], {
    onError: () => "tokyo-night", // Default on error
  });

  const currentTheme = currentThemeRaw?.trim() || "tokyo-night";

  // Track switching state for UI feedback
  const [isSwitching, setIsSwitching] = useState(false);

  const switchTheme = async (themeId: string) => {
    if (themeId === currentTheme) return; // Already active

    setIsSwitching(true);
    try {
      await showToast({
        style: Toast.Style.Animated,
        title: "Switching theme...",
      });

      // Use full path to theme-set
      await execAsync(`${process.env.HOME}/.local/bin/theme-set ${themeId}`);

      // Revalidate current theme after switch
      revalidate();

      await showToast({
        style: Toast.Style.Success,
        title: `Switched to ${themes.find((t) => t.id === themeId)?.name}`,
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to switch theme",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <Grid
      columns={6}
      isLoading={isLoading || isSwitching}
      searchBarPlaceholder="Search themes..."
    >
      {themes.map((theme) => (
        <Grid.Section
          key={theme.id}
          title={theme.name}
          subtitle={currentTheme === theme.id ? "✓ Current" : undefined}
        >
          {theme.colors.map((color, index) => (
            <Grid.Item
              key={`${theme.id}-${index}`}
              content={{ color }}
              title={COLOR_LABELS[index]}
              subtitle={color}
              actions={
                <ActionPanel>
                  <Action
                    title={
                      currentTheme === theme.id ? "Already Active" : "Set Theme"
                    }
                    icon={Icon.Paintbrush}
                    onAction={() => switchTheme(theme.id)}
                  />
                </ActionPanel>
              }
            />
          ))}
        </Grid.Section>
      ))}
    </Grid>
  );
}
```

**Key Implementation Details**:

1. **useExec hook**: Raycast-recommended way to read current theme (handles loading, errors)
2. **Promisified exec**: For one-off switch action (not reactive)
3. **revalidate()**: After switching, refresh the current theme state
4. **loadThemes()**: Reads from `themes.json` (clean JSON parsing)
5. **Subtitle with hex**: Shows hex code under each swatch for reference
6. **COLOR_LABELS array**: Maps index to display name (matches themes.json order)

**Definition of Done**:

- [ ] Grid displays sections for all themes in `themes.json`
- [ ] Each section shows 6 color swatches with labels
- [ ] Current theme marked with "✓ Current" subtitle
- [ ] Clicking any swatch in a theme section triggers switch
- [ ] Uses `useExec` for reading current theme (Raycast best practice)
- [ ] Uses promisified `exec` for switch action

---

### Task 1.4: Create Extension Icon

**File**: `assets/extension-icon.png`

**Design**: Simple palette-style icon

- Generate a 512x512 PNG with color swatches arranged in a grid or palette shape
- Use representative colors from the themes (blues, greens, oranges)
- Can use online icon generators or create SVG and convert

**Approach**:

1. Create SVG with 4-6 color squares in a palette arrangement
2. Convert to PNG at 512x512
3. Alternative: Use an existing palette icon from SF Symbols or icon libraries

**Definition of Done**:

- [ ] `assets/extension-icon.png` exists (512x512 recommended)
- [ ] Icon visible in Raycast command list
- [ ] Icon represents "theme/palette" concept

---

### Task 1.5: Create AGENTS.md for Extension

**File**: `raycast/extensions/theme-switcher/AGENTS.md`

````markdown
# Theme Switcher (Raycast Extension)

Visual theme picker with color palette swatches.

## WHERE TO LOOK

| Task          | Location               | Notes                            |
| ------------- | ---------------------- | -------------------------------- |
| Add new theme | `themes/themes.json`   | Add object with id, name, colors |
| Change colors | `themes/themes.json`   | Edit colors array (6 hex values) |
| Theme loader  | `src/themes.ts`        | Reads and parses themes.json     |
| CLI path      | `src/switch-theme.tsx` | `~/.local/bin/theme-set`         |

## Commands

```bash
npm run dev     # Start in Raycast dev mode
npm run build   # Build for production
npm run lint    # Run ESLint
```

## Data Flow

```
themes/themes.json  -->  src/themes.ts (loader)  -->  src/switch-theme.tsx (UI)
                                                              |
                                                              v
                                                     ~/.local/bin/theme-set
```

## Adding a New Theme

1. Create `themes/meta/<name>.env` (for CLI)
2. Create `themes/configs/<name>/*` (app configs)
3. Add entry to `themes/themes.json`:
   ```json
   {
     "id": "theme-name",
     "name": "Display Name",
     "colors": [
       "#bg",
       "#primary",
       "#secondary",
       "#accent",
       "#success",
       "#error"
     ]
   }
   ```

## Dependencies

- `theme-set` CLI must be installed (`~/.local/bin/theme-set`)
- `themes/themes.json` must exist
- macOS only (matches theme system constraint)

## Anti-Patterns

| Pattern                        | Why Bad                                 | Alternative                   |
| ------------------------------ | --------------------------------------- | ----------------------------- |
| Hardcode theme colors in TSX   | Duplicates data, manual sync needed     | Read from themes.json         |
| Parse .env files in Node.js    | Hacky regex, not designed for Node      | Use JSON manifest             |
| Add Windows/Linux support      | Theme system is macOS-only              | Document constraint           |
| Use child_process.exec for all | Doesn't integrate with Raycast patterns | Use useExec for reading state |
````

**Definition of Done**:

- [ ] AGENTS.md created with table-based format
- [ ] Documents key locations and commands
- [ ] Lists anti-patterns

---

### Phase 1 Checkpoint

**Verification Protocol**:

```bash
cd raycast/extensions/theme-switcher
npm install
npm run lint
npm run build
npm run dev  # Test in Raycast
```

**Manual Tests**:

1. Open Raycast, search "Switch Theme"
2. Verify 3 theme sections appear
3. Verify current theme has "✓ Current" marker
4. Click a swatch → theme switches
5. Verify toast messages appear
6. Verify apps reload (SketchyBar, Ghostty, Borders)

---

## Phase 2: CLI Improvements [~1 hour]

### Task 2.0: Add jq to Brewfile

**File**: `Brewfile`
**Location**: After line 7 (with other CLI tools)

**Add**:

```
brew "jq"
```

**Definition of Done**:

- [ ] `jq` added to Brewfile
- [ ] `brew bundle check` passes

---

### Task 2.1: Add --json Flag

**File**: `themes/.local/bin/theme-set`
**Location**: After argument parsing (line ~96)

**Behavior**:

```bash
theme-set --json
# Output:
{
  "current": "tokyo-night",
  "themes": ["everforest", "gruvbox", "tokyo-night"]
}
```

**Implementation**:

```bash
# Add to case statement
--json|-j)
    current=$(get_current_theme)
    themes_json=$(printf '%s\n' "${THEMES[@]}" | jq -R . | jq -s .)
    echo "{\"current\":\"$current\",\"themes\":$themes_json}"
    exit 0
    ;;
```

**Note**: Requires `jq` (add to Brewfile in Task 2.0).

**Definition of Done**:

- [ ] `theme-set --json` outputs valid JSON
- [ ] JSON contains `current` and `themes` keys
- [ ] Exit code 0 on success

---

### Task 2.2: Add --dry-run Flag

**File**: `themes/.local/bin/theme-set`

**Behavior**:

```bash
theme-set gruvbox --dry-run
# Output:
Dry run: theme-set gruvbox

Would modify:
  - ~/.config/sketchybar/colors.lua → themes/configs/gruvbox/sketchybar-colors.lua
  - ~/.config/ghostty/theme.conf → themes/configs/gruvbox/ghostty.conf
  - ~/.config/borders/bordersrc → themes/configs/gruvbox/bordersrc
  - ~/.p10k.theme.zsh → themes/configs/gruvbox/p10k-theme.zsh
  - ~/.config/nvim/lua/plugins/theme.lua → themes/configs/gruvbox/neovim.lua
  - ~/Library/.../appearance.json (cssTheme: "Obsidian gruvbox")
  - ~/Library/.../Antigravity/User/settings.json (colorTheme: "Gruvbox Dark Hard")
  - ~/.config/opencode/opencode.json (theme: "gruvbox")
  - Wallpaper: themes/wallpapers/gruvbox.png
```

**Implementation approach**:

1. Add `DRY_RUN=false` variable
2. Parse `--dry-run` flag to set `DRY_RUN=true`
3. Wrap each action in `if [[ "$DRY_RUN" == "false" ]]`
4. Print intended action in dry-run mode

**Definition of Done**:

- [ ] `theme-set gruvbox --dry-run` shows all planned changes
- [ ] No actual files modified during dry run
- [ ] Exit code 0 on success

---

### Task 2.3: Update Usage/Help

**Update `usage()` function**:

```bash
usage() {
    echo "Usage: theme-set <theme> [options]"
    echo "       theme-set --next | --prev"
    echo "       theme-set --json"
    echo ""
    echo "Arguments:"
    echo "  <theme>       Theme name to set"
    echo ""
    echo "Options:"
    echo "  --next, -n    Cycle to next theme"
    echo "  --prev, -p    Cycle to previous theme"
    echo "  --json, -j    Output current theme and available themes as JSON"
    echo "  --dry-run     Show what would change without applying"
    echo "  --help, -h    Show this help message"
    echo ""
    echo "Available themes:"
    for d in "$THEMES_DIR/configs"/*/; do
        echo "  - $(basename "$d")"
    done
    exit 1
}
```

**Definition of Done**:

- [ ] Help shows all new options
- [ ] Examples are clear and accurate

---

### Task 2.4: Update themes/README.md

Add new section documenting CLI flags:

````markdown
## CLI Options

### Status and Information

```bash
theme-set              # Show current theme and list available
theme-set --json       # Output as JSON (for scripting)
```
````

### Switching Themes

```bash
theme-set tokyo-night  # Switch to specific theme
theme-set --next       # Cycle to next theme
theme-set --prev       # Cycle to previous theme
theme-set gruvbox --dry-run  # Preview what would change
```

### Raycast Integration

Open Raycast and search "Switch Theme" for a visual theme picker with color swatches.

````

**Definition of Done**:
- [ ] README documents --json and --dry-run
- [ ] Raycast integration mentioned

---

### Phase 2 Checkpoint

**Verification Protocol**:
```bash
# Syntax check
bash -n themes/.local/bin/theme-set

# Test --json
theme-set --json | jq .

# Test --dry-run
theme-set gruvbox --dry-run

# Test actual switch still works
theme-set tokyo-night
````

---

## Implementation Order

| Order | Task                             | Est. Time | Priority | Owner |
| ----- | -------------------------------- | --------- | -------- | ----- |
| 1     | 1.0 Scaffold via Raycast         | 2 min     | HIGH     | User  |
| 2     | 1.1 Move extension & update pkg  | 10 min    | HIGH     | Agent |
| 3     | 1.2a Create themes.json manifest | 10 min    | HIGH     | Agent |
| 4     | 1.2b Create themes.ts loader     | 10 min    | HIGH     | Agent |
| 5     | 1.3 Implement Grid UI            | 45 min    | HIGH     | Agent |
| 6     | 1.4 Create extension icon        | 15 min    | MEDIUM   | Agent |
| 7     | 1.5 Create AGENTS.md             | 10 min    | MEDIUM   | Agent |
| 8     | 2.0 Add jq to Brewfile           | 2 min     | HIGH     | Agent |
| 9     | 2.1 Add --json flag              | 20 min    | MEDIUM   | Agent |
| 10    | 2.2 Add --dry-run flag           | 25 min    | MEDIUM   | Agent |
| 11    | 2.3 Update help                  | 5 min     | LOW      | Agent |
| 12    | 2.4 Update README                | 10 min    | LOW      | Agent |

**Total**: ~2.75 hours

---

## Files Summary

### New Files

| File                                                          | Purpose                          |
| ------------------------------------------------------------- | -------------------------------- |
| `themes/themes.json`                                          | Theme manifest for Raycast       |
| `raycast/extensions/theme-switcher/package.json`              | Extension manifest               |
| `raycast/extensions/theme-switcher/tsconfig.json`             | TypeScript config                |
| `raycast/extensions/theme-switcher/.eslintrc.json`            | ESLint config                    |
| `raycast/extensions/theme-switcher/.prettierrc`               | Prettier config                  |
| `raycast/extensions/theme-switcher/.gitignore`                | Git ignore                       |
| `raycast/extensions/theme-switcher/assets/extension-icon.png` | Extension icon                   |
| `raycast/extensions/theme-switcher/src/themes.ts`             | Theme loader (reads themes.json) |
| `raycast/extensions/theme-switcher/src/switch-theme.tsx`      | Main command UI                  |
| `raycast/extensions/theme-switcher/AGENTS.md`                 | Extension docs                   |

### Modified Files

| File                          | Changes                            |
| ----------------------------- | ---------------------------------- |
| `Brewfile`                    | Add jq dependency                  |
| `themes/.local/bin/theme-set` | Add --json, --dry-run flags        |
| `themes/README.md`            | Document new CLI options + Raycast |

---

## Testing Checklist

### Raycast Extension

- [ ] Extension loads without errors
- [ ] Grid shows sections for all themes in `themes.json`
- [ ] Color swatches display correctly (6 per theme)
- [ ] Hex codes shown as subtitles on swatches
- [ ] Current theme indicator works (✓ Current)
- [ ] Theme switching works via swatch click
- [ ] Toast notifications appear (Switching... / Switched to X)
- [ ] Apps reload after switch (SketchyBar, Ghostty, Borders)
- [ ] Adding new theme to `themes.json` shows in extension (no code change needed)

### CLI Improvements

- [ ] `theme-set --json` outputs valid JSON
- [ ] `theme-set --json | jq .current` returns theme name
- [ ] `theme-set gruvbox --dry-run` shows all changes
- [ ] `theme-set gruvbox --dry-run` makes no file changes
- [ ] `theme-set tokyo-night` still works (regression test)
- [ ] `theme-set --help` shows all options
