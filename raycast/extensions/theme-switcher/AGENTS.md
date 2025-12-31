# Theme Switcher (Raycast Extension)

**Generated:** 2025-12-30
**Commit:** b49cd81
**Branch:** main

## OVERVIEW

Visual theme picker with editor-style preview. Reads themes from dotfiles, executes `theme-set` CLI.

## STRUCTURE

```
theme-switcher/
├── src/
│   ├── switch-theme.tsx   # Main command (List + Detail view)
│   └── themes.ts          # Theme loader, types, COLOR_KEYS
├── assets/extension-icon.png
└── package.json           # Single "switch-theme" command
```

## WHERE TO LOOK

| Task                | Location               | Notes                             |
| ------------------- | ---------------------- | --------------------------------- |
| Add new theme       | `themes/themes.json`   | In dotfiles root, not here        |
| Change preview SVG  | `src/switch-theme.tsx` | `getThemePreview()` function      |
| Modify color schema | `src/themes.ts`        | `ThemeColors` type + `COLOR_KEYS` |
| Change CLI path     | `src/switch-theme.tsx` | Line 49: `~/.local/bin/theme-set` |

## DATA FLOW

```
~/dotfiles/themes/themes.json
         │
         v
   src/themes.ts (loadThemes)
         │
         v
   src/switch-theme.tsx
         │
         ├── SVG preview (getThemePreview)
         └── exec: ~/.local/bin/theme-set <id>
```

## COLOR SCHEMA

12 named colors per theme (matches sketchybar-colors.lua):

```typescript
ThemeColors = {
  bg0,
  bg1,
  bg2, // Backgrounds (dark to light)
  fg,
  grey, // Text (normal, muted)
  red,
  green,
  yellow, // Semantic
  blue,
  magenta,
  cyan,
  orange, // Accent
};
```

## ADDING A NEW THEME

No extension code changes needed — themes load dynamically from `themes/themes.json`.

See `~/dotfiles/themes/AGENTS.md` for full checklist.

## COMMANDS

```bash
npm run dev     # Raycast dev mode
npm run build   # Production build
npm run lint    # ESLint
```

## DEPENDENCIES

- `theme-set` CLI at `~/.local/bin/theme-set`
- `themes/themes.json` in dotfiles
- macOS only

## ANTI-PATTERNS

| Pattern                | Why Bad                     | Alternative             |
| ---------------------- | --------------------------- | ----------------------- |
| Hardcode colors in TSX | Duplicates themes.json      | Read from ThemeColors   |
| Add themes here        | Extension reads dynamically | Edit themes/themes.json |
| Use exec for reads     | Raycast pattern violation   | useExec hook            |
| Windows/Linux support  | theme-set is macOS-only     | Document constraint     |
