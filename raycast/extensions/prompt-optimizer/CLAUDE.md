# Prompt Optimizer (Raycast Extension)

A Raycast extension that optimizes prompts using multiple LLM CLI tools. Transforms casual user requests into structured, professional prompts.

## Commands

```bash
npm run dev       # Start in dev mode (hot reload)
npm run build     # Build for production
npm run lint      # Run ESLint
npm run fix-lint  # Auto-fix lint issues
npx ts-node src/test-engines.ts  # Test all engine integrations
```

## Prerequisites

- Node.js (v18+)
- Raycast app installed
- CLI tools (`gemini`, `claude`, `codex`) installed and authenticated

## Architecture

### Directory Structure
```
/src
  ├── optimize-prompt.tsx  # Main command - form UI, engine/model selection
  ├── history.tsx          # History list with Markdown export
  ├── test-engines.ts      # Engine integration tests
  └── /utils
      ├── engines.ts       # Engine definitions + system prompt
      ├── exec.ts          # Safe CLI execution wrapper
      └── history.ts       # LocalStorage management (last 100 items)
```

### Engine Integration

Each engine implements this interface:
```typescript
interface Engine {
  name: string;
  displayName: string;
  defaultModel?: string;
  models?: { id: string; label: string }[];
  run: (prompt: string, model?: string) => Promise<string>;
}
```

| Engine | CLI Command | Default Model | Notes |
|--------|-------------|---------------|-------|
| Codex | `codex` | `gpt-5.2-codex` | Uses `model_reasoning_effort="high"` |
| Claude | `claude` | `sonnet` | Disabled pending CLI auth bug |
| Gemini | `gemini` | `gemini-3-flash-preview` | Isolated via `HOME` + symlink auth |


### Smart Context Handling

The system prompt in `engines.ts` includes two key rules when `context` is provided:

1. **Adaptive Context**: Classifies `<additional_context>` by type:
   - Raw data (logs, code, errors) → copied VERBATIM to `<reference_material>`
   - Instructions/preferences → incorporated into `<instructions>` or `<style>`
   - Background info → summarized in `<context>` if >50 words

2. **Verbatim Preservation**: User terminology MUST appear unchanged:
   - Tool names, CLI flags (`gemini-cli`, `--non-interactive`)
   - File paths, branch names, URLs
   - Numbers/metrics (`4gb+`, `100+ lines`)
   - Colloquial phrases (`root issues`, `bandaid fixes`)

Test with: `npx ts-node src/test-context-preservation.ts`

### Key Patterns

- **PATH Handling**: `safeExec` prepends `/opt/homebrew/bin` for Homebrew CLI access from Raycast runtime
- **Timeout**: 180s default on all engine calls
- **History**: Auto-saves with UUID, timestamp, engine, model, duration

## Coding Style

- TypeScript (ES2020+), explicit types for props/return values
- Prettier defaults, 2-space indent, single quotes
- React components: PascalCase; helpers: camelCase; files: kebab-case
- Linting: `@raycast/eslint-config` via `ray lint`

## Commits

- Concise imperative subject (e.g., "Add engine selection keyboard shortcut")
- Include: behavior change, testing done (`ray develop`/`ray lint`), screenshots for UI
