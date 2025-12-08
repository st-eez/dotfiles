# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev       # Start Raycast extension in dev mode (hot reload)
npm run build     # Build the extension

# Code Quality
npm run lint      # Run ESLint
npm run fix-lint  # Run ESLint with auto-fix

# Testing (manual)
npx ts-node src/test-engines.ts  # Test all LLM engine integrations
```

## Architecture

This is a Raycast extension that optimizes prompts using multiple LLM CLI tools. It transforms casual user requests into structured, professional prompts using a standardized template.

### Core Files

- `src/optimize-prompt.tsx` - Main command entry point. Form UI for prompt input, engine/model selection, and result display.
- `src/history.tsx` - History list view with export to Downloads as Markdown.
- `src/utils/engines.ts` - Engine definitions (Codex, Gemini, Opencode). Each engine defines CLI invocation and available models. Claude engine is disabled pending CLI auth bug fix.
- `src/utils/history.ts` - LocalStorage-based history (last 100 items) with CRUD operations.
- `src/utils/exec.ts` - Safe subprocess execution via `execa` with Homebrew PATH injection, timeout handling, and error normalization.

### Engine Pattern

Each engine in `engines.ts` implements the `Engine` interface:
```typescript
interface Engine {
  name: string;
  displayName: string;
  defaultModel?: string;
  models?: { id: string; label: string }[];
  run: (prompt: string, model?: string) => Promise<string>;
}
```

The `run` method calls `safeExec` which wraps the CLI tool invocation. All engines use a shared meta-prompt template (`buildOptimizationPrompt`) that structures output with specific Markdown sections.

### Key Patterns

- **PATH Handling**: `safeExec` prepends `/opt/homebrew/bin` to PATH for Homebrew CLI access from Raycast runtime.
- **Timeout**: Default 180s timeout on all engine calls.
- **History**: Auto-saves last 100 optimizations with UUID, timestamp, engine, model, duration.
