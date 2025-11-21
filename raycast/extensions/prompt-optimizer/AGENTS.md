# Repository Guidelines

## Project Structure & Modules
- `src/optimize-prompt.tsx`: main Raycast command entry.
- `src/utils/`: shared helpers (engine handling, formatting, API calls).
- `src/test-engines.ts`: mock/test engine definitions used during local runs.
- `assets/`: icons and static assets.
- Config: `package.json`, `tsconfig.json`, `eslint.config.js`, `raycast-env.d.ts`.

## Build, Test, and Development Commands
- `npm run dev` → `ray develop`; runs the extension in the Raycast dev environment with hot reload.
- `npm run build` → `ray build`; validates the extension for store readiness.
- `npm run lint` → `ray lint`; checks formatting, types, and Raycast-specific rules.
- `npm run fix-lint` → autofix lint issues where possible.
- Publishing: `npm run publish` uses `@raycast/api@latest publish`. `prepublishOnly` intentionally blocks `npm publish` to npm—use `publish` instead.

## Coding Style & Naming
- Language: TypeScript (ES2020+). Prefer explicit types for props and return values.
- Formatting: Prettier defaults; 2-space indentation; single quotes unless autoformatted otherwise.
- Linting: `@raycast/eslint-config` with `ray lint`; address warnings before merging.
- Naming: React components PascalCase; helpers camelCase; files kebab-case or consistent with current patterns (e.g., `optimize-prompt.tsx`).

## Testing Guidelines
- No formal test suite yet; rely on `ray develop` for manual verification of UI/state.
- When adding test utilities, co-locate lightweight mocks in `src/utils/__tests__` or similar and name files `*.test.ts`.
- Keep new logic small and covered by at least smoke tests when feasible.

## Commit & Pull Request Guidelines
- Commits: concise imperative subject (e.g., “Add engine selection keyboard shortcut”); group related changes only.
- PRs: include summary of behavior change, testing done (`ray develop`/`ray lint`), and screenshots/GIFs for UI tweaks.
- Link relevant issues/tickets; call out breaking changes or new settings explicitly.

## Security & Configuration
- Do not commit secrets; Raycast preferences and API tokens should stay in local env vars or Raycast secure storage.
- If you add new config flags, document defaults and env variables in `README.md`.
