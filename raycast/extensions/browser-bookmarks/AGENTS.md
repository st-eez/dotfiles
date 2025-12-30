# BROWSER BOOKMARKS EXTENSION

**Context:** Raycast extension for searching bookmarks across multiple browsers (Safari, Chrome, Arc, Firefox, etc.)

## OVERVIEW

Multi-browser bookmark search with profile support and frecency-based sorting.

## WHERE TO LOOK

| Task                    | Location                                             |
| :---------------------- | :--------------------------------------------------- |
| Add new browser support | `src/hooks/`, `assets/`, `src/utils/browsers.ts`     |
| Modify sorting logic    | `src/utils/frecency.ts`                              |
| Permission handling     | `src/components/PermissionErrorScreen.tsx`           |
| UI/Action logic         | `src/index.tsx`, `src/components/SelectBrowsers.tsx` |

## COMMANDS

```bash
npm run dev      # Start development mode
npm run build    # Build extension for production
npm run lint     # Run ESLint (enforces import ordering)
npm run fix-lint # Auto-fix linting issues
```

## CONVENTIONS

- **Hooks:** Every browser MUST have a corresponding hook in `src/hooks/` following `use[Name]Bookmarks.ts`.
- **Assets:** Browser icons in `assets/` should be lowercase (e.g., `chrome.png`).
- **Imports:** ESLint enforced alphabetical order with newlines between groups.
- **Permission Handling:** Always wrap browser data access in permission checks for sandboxed environments.
- **Sorting:** Use the `frecency` utility to ensure consistent result ranking.

## ANTI-PATTERNS

- Adding browser support without a dedicated hook file.
- Hardcoding browser paths without considering profile variations.
- Skipping permission error UI for inaccessible bookmark files.
- Manual sorting that ignores user's bookmark usage frequency.
- Testing with empty browser profiles only.
