# Task Completion Checklist

## After Implementation

1. **Lint & Build**
   ```bash
   npm run lint --fix && npm run build
   ```
   Errors block commit; warnings are advisory.

2. **Verify in Raycast**
   ```bash
   npm run dev
   ```
   Test the extension in Raycast dev mode.

3. **Run code-simplifier** (optional)
   Use the code-simplifier subagent to refine code.

4. **Commit**
   Use conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`

## Critical Gotchas

- `v1-baseline.ts` is **FROZEN** - create new strategy files instead
- Test files: `import "./setup-test"` must be first line
- Always use `withIsolatedGemini()`/`withIsolatedCodex()` wrappers

## After Context Compaction

Re-activate project in Serena and re-read any active plan file.
