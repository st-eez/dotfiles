# Code Style & Conventions

## TypeScript

- Target: ES2023, strict mode enabled
- Use `unknown` over `any`; narrow with `instanceof` checks
- Explicit types for function params and return values

## Formatting (Prettier)

- Print width: 120 characters
- Double quotes for strings
- 2-space indent
- Trailing commas in multi-line

## Naming

- React components: `PascalCase` (e.g., `ResolveAmbiguity`)
- Utility functions: `camelCase` (e.g., `buildPrompt`)
- Files: `kebab-case` (e.g., `resolve-ambiguity.tsx`)
- Interfaces: `PascalCase`, no `I` prefix

## Error Handling

```typescript
try {
  // ...
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Operation failed: ${message}`);
}
```

## Imports

1. External deps
2. @raycast packages
3. Local utils
4. Local components
