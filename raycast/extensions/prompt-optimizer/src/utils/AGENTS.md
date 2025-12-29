# Utils - Engine & Execution Core

Core utilities for LLM CLI integration, isolated execution, and data management.

## WHERE TO LOOK

| Task                      | File            | Notes                                             |
| ------------------------- | --------------- | ------------------------------------------------- |
| Add new engine            | `engines.ts`    | Implement `Engine` interface, add to `engines[]`  |
| Parse engine output       | `exec.ts`       | `parseGeminiJson`, `parseOpencodeJson`            |
| Create isolation wrapper  | `exec.ts`       | Follow `withIsolatedGemini` pattern               |
| Add optimization metadata | `types.ts`      | `TimingData`, `TokenData`, `OptimizationMetadata` |
| Modify history storage    | `history.ts`    | LocalStorage, 100 item limit                      |
| A/B evaluation logic      | `evaluator.ts`  | Gate checks, scoring, statistical analysis        |
| Statistical tests         | `statistics.ts` | p-value, SRM detection                            |

## Key Files

| File            | Purpose                                         |
| --------------- | ----------------------------------------------- |
| `engines.ts`    | Engine interface + Gemini/Codex implementations |
| `exec.ts`       | `safeExec`, isolation wrappers, timeout config  |
| `evaluator.ts`  | A/B test evaluation: gates, scoring, metadata   |
| `types.ts`      | Shared types for timing/tokens/metadata         |
| `statistics.ts` | Statistical significance calculations           |
| `history.ts`    | LocalStorage wrapper for prompt history         |
| `templates.ts`  | `{{variable}}` substitution logic               |
| `format.ts`     | XML prompt output formatting                    |
| `cache.ts`      | LLM response caching for tests                  |

## Isolation Pattern

```
withIsolatedGemini(callback):
  1. Create temp: /tmp/gemini-{uuid}/.gemini/
  2. Symlink oauth_creds.json (auth only)
  3. Write isolated settings.json (tools disabled)
  4. Write empty AGENTS.md, GEMINI.md (no global instructions)
  5. Execute callback with HOME=tempDir
  6. Cleanup on exit

withIsolatedCodex(callback):
  1. Create temp: /tmp/codex-{uuid}/
  2. Symlink auth.json (auth only)
  3. Write minimal AGENTS.md
  4. Execute callback with CODEX_HOME=tempDir
  5. Cleanup on exit
```

## Engine Implementation Checklist

- [ ] Add to `engines[]` array
- [ ] Implement `run()` with proper timeout
- [ ] Implement `audit()` for critic flow
- [ ] Implement `runWithClarifications()`
- [ ] Add `runOrchestrated()` if supporting smart mode
- [ ] Create isolation wrapper if CLI uses global config
- [ ] Parse output (JSON vs plain text)
- [ ] Test with `npx ts-node src/test-engines.ts`

## Anti-Patterns

- **Direct CLI calls**: Always use `safeExec` for PATH handling
- **Copying full config**: Isolation = auth only, no tools/MCP
- **Missing cleanup**: `finally` block must `rmSync` temp dirs
