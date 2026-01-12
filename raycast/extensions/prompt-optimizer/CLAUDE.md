# Prompt Optimizer

Raycast extension: optimizes prompts via Gemini/Codex CLI.

## Rules

1. TypeScript: `npm run lint --fix && npm run build` after implementation; errors block commit
2. After compact: re-activate project in Serena, re-read any active plan
3. Use Serena tools for code exploration and editing
4. Keep plan file in sync with implementation progress
5. Use detailed TodoWrite for task tracking
6. After implementation: run code-simplifier → verify with `npm run dev` → commit

## Commands

```bash
npm run dev    # Dev mode (hot reload)
npm run build  # Production build
npm run lint   # Lint checks
```

## Gotchas

- `v1-baseline.ts` is FROZEN for A/B comparison - create new strategy files instead
- Test files: `import "./setup-test"` must be first line (mocks Raycast API)
- Use `withIsolatedGemini()`/`withIsolatedCodex()` wrappers to prevent global instruction leakage
