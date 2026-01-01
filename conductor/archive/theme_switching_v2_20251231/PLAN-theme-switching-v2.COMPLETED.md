# Theme Switching v2 - Implementation Plan

**Created**: 2025-12-30
**Status**: ✅ PHASE 1 COMPLETE | Phase 2 CANCELLED
**Archived**: 2025-12-31
**Platform**: macOS only

---

## Completion Summary

### Phase 1: Raycast Extension — ✅ COMPLETE (exceeded plan)

Implementation diverged from plan with **superior design**:

| Planned                       | Actual Implementation                                |
| ----------------------------- | ---------------------------------------------------- |
| Grid with 6-color swatches    | List with SVG editor-style preview                   |
| Simple color array (6 colors) | Full 12-color named palette with TypeScript types    |
| Basic current theme indicator | Detail panel with color tags + metadata              |
| `next-wallpaper.tsx`          | `cycle-wallpaper.tsx` (from wallpaper-switcher plan) |

**Files created:**

- `raycast/extensions/theme-switcher/src/switch-theme.tsx` — List view with SVG previews
- `raycast/extensions/theme-switcher/src/themes.ts` — Type-safe theme loader with validation
- `raycast/extensions/theme-switcher/src/cycle-wallpaper.tsx` — No-view wallpaper cycling
- `raycast/extensions/theme-switcher/AGENTS.md` — Extension documentation
- `themes/themes.json` — 12-color palette per theme

### Phase 2: CLI Improvements — ❌ CANCELLED

`--json` and `--dry-run` flags deemed unnecessary:

- Current theme readable via `cat ~/.config/current-theme`
- Raycast extension provides visual switching
- No automation use cases identified

---

## Overview

Enhance the existing theme-set CLI with a Raycast extension for visual theme switching and add scripting/automation flags to the CLI.

### What Exists (v1)

- `theme-set` CLI (321 lines bash, `themes/.local/bin/theme-set`)
- 8 apps: SketchyBar, Ghostty, Borders, Neovim, Obsidian, Antigravity, OpenCode, Wallpaper (Starship pending Phase 3)
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
**Status**: ✅ COMPLETE

- [x] Extension created via Raycast "Create Extension"
- [x] Moved to `raycast/extensions/theme-switcher/`

---

### Task 1.1: Move Extension to Dotfiles & Update package.json

**Status**: ✅ COMPLETE

- [x] Extension at `raycast/extensions/theme-switcher/`
- [x] package.json configured (author: steezz, platforms: macOS)

---

### Task 1.2: Create themes.json Manifest

**Status**: ✅ COMPLETE (exceeded plan)

Implemented with **12 named colors** instead of 6-color array:

```typescript
ThemeColors = {
  bg0,
  bg1,
  bg2,
  fg,
  grey,
  red,
  green,
  yellow,
  blue,
  magenta,
  cyan,
  orange,
};
```

- [x] `themes/themes.json` created with full 12-color palettes
- [x] `src/themes.ts` with type-safe validation and error handling

---

### Task 1.3: Implement Theme UI

**Status**: ✅ COMPLETE (design changed)

Implemented **List view with SVG editor preview** instead of Grid with color swatches:

- SVG-generated code editor mockup showing syntax highlighting
- Detail panel with color tag metadata
- More visually informative than simple color squares

- [x] List view with Detail panel
- [x] SVG preview generation (`getThemePreview()`)
- [x] Current theme indicator with CheckCircle icon
- [x] Uses `useExec` for reading current theme
- [x] Uses `execFileAsync` for switching

---

### Task 1.4: Create Extension Icon

**Status**: ✅ COMPLETE

- [x] `assets/extension-icon.png` exists
- [x] Icon visible in Raycast command list

---

### Task 1.5: Create AGENTS.md for Extension

**Status**: ✅ COMPLETE

- [x] AGENTS.md created with table-based format
- [x] Documents data flow, key locations, commands
- [x] Lists anti-patterns

---

### Phase 1 Checkpoint — ✅ VERIFIED

All tests passing. Extension fully functional.

---

## Phase 2: CLI Improvements — ❌ CANCELLED

**Reason**: No identified use cases for `--json` or `--dry-run` flags.

Existing alternatives:

- `cat ~/.config/current-theme` for scripting
- Raycast extension for visual switching
- CLI works fine for direct use

---

## Final Files

| File                                                          | Status             |
| ------------------------------------------------------------- | ------------------ |
| `themes/themes.json`                                          | ✅ Created         |
| `raycast/extensions/theme-switcher/src/switch-theme.tsx`      | ✅ Created         |
| `raycast/extensions/theme-switcher/src/themes.ts`             | ✅ Created         |
| `raycast/extensions/theme-switcher/src/cycle-wallpaper.tsx`   | ✅ Created (bonus) |
| `raycast/extensions/theme-switcher/AGENTS.md`                 | ✅ Created         |
| `raycast/extensions/theme-switcher/assets/extension-icon.png` | ✅ Created         |
