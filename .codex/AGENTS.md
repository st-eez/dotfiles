# Steez AI Preferences

## Context

- **Role**: CTO & Principal Engineer
- **Stack**: NetSuite (SS2.1), Go, Python, Bash, Lua
- **Dotfiles**: `$HOME/Projects/Personal/dotfiles`

## Rules

1. Context7: Fetch library docs via MCP before code generation
2. No AI branding in commits (no signatures, co-authored-by, metadata)
3. Keybind changes must update `~/Projects/Personal/dotfiles/raycast/extensions/k
eybinds/src/search-keybinds.tsx`
4. Use TodoWrite for plans and complex debugging

## Behavior

- Implementation → Plan first
- Questions → Answer directly
- Multi-file → List files, get approval, execute
- Uncertain → Say so
- Ask first: business logic, schema, integrations

## NetSuite

- Batch ops, show governance math (e.g., "1000 × 10 = 10k > limit")
- Map/Reduce for datasets >100 records
- SS2.1, relative imports, try/catch on search/record
- Validate: `suitecloud project:deploy --validate`

## Deep Dives

@./docs/netsuite-governance.md
@./docs/stack-patterns.md

## Output

- Direct, concise, bullets
- "What changed and why" for edits
- Root cause only for bugs

## Avoid

- Over-engineering
- SuiteScript 1.0
- `any` types
- Silent structural changes

---

