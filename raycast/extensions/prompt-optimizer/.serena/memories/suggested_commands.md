# Development Commands

## Daily Development

```bash
npm run dev         # Start in Raycast dev mode (hot reload)
npm run build       # Build for production
npm run lint        # Run ESLint checks
npm run fix-lint    # Auto-fix lint issues
```

## Testing

```bash
npx ts-node src/test-engines.ts              # Test engine integrations
npx ts-node src/test-context-preservation.ts # Test context handling
npx ts-node src/test-smart-quality.ts        # Test smart mode output

# A/B Testing
npx ts-node src/test-ab-runner.ts \
  --baseline src/prompts/v1-baseline.ts \
  --candidate src/prompts/v2-lean.ts

# Test Bench (interactive)
npx ts-node src/test-bench.ts
```

## Publishing

```bash
npm run publish     # Publish to Raycast Store
```

## System Commands (Darwin)

- `git` - version control
- `ls`, `cd`, `rm` - file operations
- `npx ts-node` - run TypeScript files directly
