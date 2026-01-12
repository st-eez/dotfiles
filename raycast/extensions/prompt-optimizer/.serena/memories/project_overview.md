# Prompt Optimizer

Raycast extension that optimizes prompts via Gemini/Codex CLI. Transforms casual requests into structured professional prompts.

## Tech Stack

- **Runtime**: Raycast (macOS/Windows)
- **Language**: TypeScript (ES2023, strict mode)
- **UI**: React with Raycast API components
- **CLI Tools**: `gemini`, `codex` (authenticated externally)

## Project Structure

```
src/
  optimize-prompt.tsx    # Main command - form UI
  resolve-ambiguity.tsx  # Critic flow - clarification wizard
  history.tsx            # History list view
  prompts/               # Prompt strategy implementations
    v1-baseline.ts       # Production strategy (FROZEN)
    archive/             # Failed experiments with lessons
  utils/
    engines.ts           # Engine definitions, personas
    exec.ts              # Safe CLI execution wrapper
  bench/                 # Test bench CLI modules
  test-data/             # Test case definitions
```

## Key Concepts

- **Engines**: Gemini and Codex CLI wrappers with isolation
- **Isolation**: `withIsolatedGemini()`/`withIsolatedCodex()` prevent global instruction leakage
- **A/B Testing**: Built-in framework for testing prompt strategies
