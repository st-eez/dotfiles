# Keybinds

Raycast extension: searchable reference for all keybindings (Aerospace, Ghostty, Neovim, macOS, apps).

## Commands

```bash
npm run build  # Production build — MUST run after any edit
npm run dev    # Dev mode (hot reload)
npm run lint   # Lint checks
```

## Rules

- `npm run build` must pass after every edit before committing
- All keybinding data lives in `src/search-keybinds.tsx` as typed arrays — no external data files
