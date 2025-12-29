# Prompt Optimizer (Raycast Extension)

**Generated:** 2025-12-28  
**Commit:** bdca1de  
**Branch:** main

Raycast extension: optimizes prompts via Gemini/Codex CLI. Transforms casual requests → structured professional prompts.

## WHERE TO LOOK

| Task                   | Location                                                          | Notes                              |
| ---------------------- | ----------------------------------------------------------------- | ---------------------------------- |
| Add new LLM engine     | `src/utils/engines.ts`                                            | Implement `Engine` interface       |
| Change prompt strategy | `src/prompts/`                                                    | See FROZEN warning in v1-baseline  |
| Add persona            | `src/prompts/personas.ts` + `src/utils/engines.ts` PERSONAS array |
| Modify isolation       | `src/utils/exec.ts`                                               | `withIsolated*` wrappers           |
| Add test case          | `src/test-data/cases/`                                            | Follow existing naming pattern     |
| Debug CLI execution    | `src/utils/exec.ts` safeExec                                      | Check PATH, timeout, env vars      |
| A/B test new strategy  | `src/test-ab-runner.ts`                                           | `--baseline` + `--candidate` flags |

## Commands

```bash
# Development
npm run dev         # Start in Raycast dev mode (hot reload)
npm run build       # Build for production
npm run lint        # Run ESLint checks
npm run fix-lint    # Auto-fix lint issues

# Testing (ts-node scripts, no test framework)
npx ts-node src/test-engines.ts              # Test all engine integrations
npx ts-node src/test-context-preservation.ts # Test context handling
npx ts-node src/test-smart-quality.ts        # Test smart mode output quality

# A/B Testing Framework
npx ts-node src/test-ab-runner.ts \
  --baseline src/prompts/v1-baseline.ts \
  --candidate src/prompts/v2-lean.ts \
  [--dry-run] \
  [--category code|writing|system-design|data-analysis|simple|edge] \
  [--judge codex-high|codex-medium|gemini-flash]

# Test Bench (interactive or CLI)
npx ts-node src/test-bench.ts                    # Interactive mode
npx ts-node src/test-bench.ts validate --strategy src/prompts/v1-baseline.ts
npx ts-node src/test-bench.ts optimize --strategy src/prompts/v1-baseline.ts --case code-001
npx ts-node src/test-bench.ts judge --strategy src/prompts/v1-baseline.ts --judge gemini-flash
npx ts-node src/test-bench.ts cache status
npx ts-node src/test-bench.ts ab --baseline <run> --candidate <run> --judge codex-high
```

### CLI Output Options

All test scripts support these output options:

| Flag              | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `--json`          | Output results as JSON (implies --quiet for logs)            |
| `--quiet`, `-q`   | Suppress non-error output                                    |
| `--verbose`, `-v` | Enable debug logging                                         |
| `--no-color`      | Disable colored output                                       |
| `--ascii`         | Use ASCII characters instead of Unicode                      |
| `--simple`        | Linear output without animations (accessibility/CI friendly) |

Environment variables:

- `NO_COLOR=1` - Disable colors (standard)
- `FORCE_COLOR=1` - Force colors even in non-TTY
- `CI=true` - Detected automatically, disables interactive prompts

## Prerequisites

- Node.js v18+
- Raycast app installed
- CLI tools authenticated: `gemini`, `codex` (optionally `claude`)
- Bun (optional, for faster execution)

## Architecture

```
/src
  /prompts/              # Prompt strategy implementations
    types.ts             # PromptStrategy interface
    v1-baseline.ts       # Production strategy
    v2-lean.ts           # Experimental strategy
    personas.ts          # Persona instruction definitions
    smart.ts             # Smart mode orchestration prompts
  /test/lib/             # Test utilities
    analysis.ts          # Result analysis helpers
    test-utils.ts        # LLM execution wrappers with retries
  /test-data/            # Test case definitions
    test-cases.ts        # Main test case registry
  /utils/
    cli-args.ts          # CLI argument parsing (--json, --quiet, --simple, etc.)
    cli-cancel.ts        # Graceful cancellation handling (SIGINT/SIGTERM)
    cli-output.ts        # Centralized logging, colors, symbols, headers
    cli-progress.ts      # Progress bars with ETA, spinners
    cli-table.ts         # Table rendering with cli-table3
    cli-types.ts         # Shared CLI type definitions
    engines.ts           # Engine definitions, personas, smart mode parsing
    evaluator.ts         # A/B test evaluation logic
    exec.ts              # Safe CLI execution wrapper
    format.ts            # Output formatting helpers
    history.ts           # LocalStorage management (last 100 items)
    statistics.ts        # Statistical analysis (p-value, SRM detection)
    templates.ts         # Template variable substitution
    types.ts             # Shared types (timing, tokens, metadata)
  /bench/                  # Test bench CLI modules
    index.ts             # Main entry, CLI routing
    args.ts              # Argument parsing for test-bench
    interactive.ts       # @clack/prompts interactive mode
    types.ts             # Shared types, constants, utilities
    commands/            # Individual command implementations
  optimize-prompt.tsx    # Main command - form UI
  resolve-ambiguity.tsx  # Critic flow - clarification wizard
  history.tsx            # History list view
  templates.tsx          # Template management UI
  setup-test.ts          # Raycast API mock for CLI tests
```

### Engine Integration

Each engine implements the `Engine` interface with standard and critic operations:

```typescript
interface Engine {
  name: string;
  displayName: string;
  icon: Icon;
  defaultModel?: string;
  models?: { id: string; label: string }[];
  run: (prompt, model?, mode?, context?, persona?) => Promise<string>;
  audit: (prompt, model?, context?, persona?) => Promise<ClarificationQuestion[]>;
  runOrchestrated?: (prompt, model?, mode?, context?) => Promise<SmartModeResult>;
  // ... additional critic methods
}
```

| Engine | CLI      | Default Model            | Notes                                   |
| ------ | -------- | ------------------------ | --------------------------------------- |
| Gemini | `gemini` | `gemini-3-flash-preview` | Isolated via temp `HOME` + symlink auth |
| Codex  | `codex`  | `gpt-5.2-codex`          | Uses `model_reasoning_effort="high"`    |
| Claude | `claude` | `sonnet`                 | Disabled (CLI auth bug)                 |

### Key Implementation Patterns

- **Isolated Execution**: `withIsolatedGemini()` / `withIsolatedCodex()` create temp dirs with symlinked auth, empty `AGENTS.md` to prevent global instruction leakage
- **PATH Handling**: `safeExec` prepends `/opt/homebrew/bin` and `~/.bun/bin` for CLI access from Raycast runtime
- **Timeout**: 180s base (quick mode), 300s (detailed mode), 1.5x multiplier for orchestrated
- **Retries**: Test utils include `withRetry()` for flaky API calls

## Code Style

### TypeScript

- Target: ES2023, strict mode enabled
- Explicit types for function params, return values, and public interfaces
- Prefer `interface` over `type` for object shapes
- Use `unknown` over `any`; narrow with `instanceof` checks

### Formatting (Prettier)

- Print width: 120 characters
- Double quotes (`"`) for strings
- 2-space indent
- Trailing commas in multi-line

### Naming Conventions

- React components: `PascalCase` (e.g., `ResolveAmbiguity`)
- Utility functions: `camelCase` (e.g., `buildPrompt`)
- Files: `kebab-case` (e.g., `resolve-ambiguity.tsx`)
- Interfaces: `PascalCase`, no `I` prefix
- Type exports: Group at top, re-export from index if public

### Error Handling

```typescript
// Pattern: typed error extraction
try {
  // ...
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Operation failed: ${message}`);
  // Throw with context or return default
}
```

- Use `console.error()` / `console.warn()` for logging
- Return empty arrays `[]` or default objects on parse failures
- Never silently swallow errors in production paths

### Imports

- Named imports from `@raycast/api` for Raycast APIs
- Relative imports for local modules (`./utils/engines`)
- Group: external deps, @raycast, local utils, local components

### React/Raycast Patterns

- Functional components with hooks (`useState`, `useEffect`)
- `useNavigation` for screen transitions (`push`, `pop`)
- `showToast` for user feedback during async operations
- `LocalStorage` for persistence (JSON serialized)

## Testing

### Test File Structure

Tests are standalone TypeScript files run via `ts-node`:

```typescript
import "./setup-test"; // Must be first - mocks @raycast/api
import { engines } from "./utils/engines";

async function testEngines() {
  for (const engine of engines) {
    try {
      const result = await engine.run("test prompt");
      console.log(`OK ${engine.displayName}: ${result.length} chars`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`FAIL ${engine.displayName}: ${msg}`);
    }
  }
}
testEngines();
```

### Running Single Tests

```bash
npx ts-node src/test-engines.ts           # Quick engine smoke test
npx ts-node src/test-smart-quality.ts     # Smart mode quality check
```

### A/B Test Reports

Results saved to `/ab_results/ab_test_results_<timestamp>.json` with:

- Schema version, timing, test case count
- Per-case evaluation scores and gate pass/fail
- Statistical summary (p-value, SRM detection)
- Committee-style role detection analysis

## Commits

- Concise imperative subject (e.g., "Add engine selection keyboard shortcut")
- Include: behavior change, testing done (`npm run lint && npm run build`)
- For UI changes: test with `npm run dev` in Raycast

## Common Tasks

### Adding a New Engine

1. Add entry to `engines` array in `src/utils/engines.ts`
2. Implement `run`, `audit`, and optional orchestrated methods
3. Create isolation wrapper if CLI needs auth isolation
4. Test with `npx ts-node src/test-engines.ts`

### Creating a Prompt Strategy

1. Create file in `src/prompts/` implementing `PromptStrategy`
2. Export `buildPrompt`
3. Test with A/B runner against baseline
4. Update import in `engines.ts` when promoting

### Modifying Personas

- Edit `src/prompts/personas.ts` for persona instructions
- Update `PERSONAS` array in `src/utils/engines.ts` for UI display

## Anti-Patterns (THIS PROJECT)

| Pattern                 | Why Bad                       | Alternative                  |
| ----------------------- | ----------------------------- | ---------------------------- |
| Modify `v1-baseline.ts` | **FROZEN** for A/B comparison | Create new strategy file     |
| Suppress type errors    | Masks real bugs               | Fix the type issue           |
| Skip isolation wrappers | Global instructions leak      | Always use `withIsolated*`   |
| Hardcode CLI paths      | Breaks on different systems   | Use `safeExec` PATH handling |
| Sync LLM calls in tests | Slow, expensive               | Use caching in test-bench    |

## Notes

- **Claude disabled**: CLI auth bug in non-interactive mode (issue #5666)
- **Test mocking**: `setup-test.ts` MUST be first import in test files
- **Caching**: `.prompt-cache/` stores expensive LLM outputs between test runs
- **ab_results/**: Generated files, gitignored - don't commit
- **Timeout math**: orchestrated = base × 1.5 (handles parallel calls + synthesis)
