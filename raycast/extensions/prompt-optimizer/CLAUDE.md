# Prompt Optimizer

Raycast extension: optimizes prompts via Gemini/Codex CLI.

## Commands

```bash
npm run dev    # Dev mode (hot reload)
npm run build  # Production build
npm run lint   # Lint checks
```

## Rules

- `npm run lint --fix && npm run build` must pass before committing

## Gotchas

- `v1-baseline.ts` is FROZEN for A/B comparison — create new strategy files instead
- Test files: `import "./setup-test"` must be first line (mocks Raycast API)
- Use `withIsolatedGemini()`/`withIsolatedCodex()` wrappers to prevent global instruction leakage
