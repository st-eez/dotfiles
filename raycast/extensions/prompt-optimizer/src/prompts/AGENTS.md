# Prompts - Strategy Implementations

Prompt optimization strategies for A/B testing framework.

## WHERE TO LOOK

| Task                        | File             | Notes                         |
| --------------------------- | ---------------- | ----------------------------- |
| Current production strategy | `v1-baseline.ts` | **FROZEN** - do not modify    |
| Experimental strategies     | `v2-lean.ts`     | Candidates for A/B testing    |
| Persona definitions         | `personas.ts`    | `PERSONA_INSTRUCTIONS` record |
| Smart mode prompts          | `smart.ts`       | Multi-persona orchestration   |
| Strategy interface          | `types.ts`       | `PromptStrategy` contract     |

## Strategy Lifecycle

```
1. Create new file (e.g., v3-structured.ts)
2. Implement PromptStrategy interface
3. Export buildPrompt
4. A/B test: npx ts-node src/test-ab-runner.ts \
     --baseline src/prompts/v1-baseline.ts \
     --candidate src/prompts/v3-structured.ts
5. If winner: update import in engines.ts
6. Freeze old baseline, new becomes baseline
```

## PromptStrategy Interface

```typescript
interface PromptStrategy {
  id: string; // "v1-baseline"
  name: string; // "V1 Baseline"
  description: string; // What this version tests
  buildPrompt: (userRequest, context?, personaId?) => string;
}
```

## Key Files

| File             | Purpose                    | Status         |
| ---------------- | -------------------------- | -------------- |
| `types.ts`       | `PromptStrategy` interface | Stable         |
| `v1-baseline.ts` | Production strategy        | **FROZEN**     |
| `v2-lean.ts`     | Experimental variant       | Active testing |
| `personas.ts`    | Persona instruction text   | Editable       |
| `smart.ts`       | Smart mode XML prompts     | Editable       |

## Prompt XML Structure

Output format:

```xml
<role>...</role>
<objective>...</objective>
<context>...</context>
<instructions>...</instructions>
<reference_material>...</reference_material>  <!-- if context provided -->
<requirements>...</requirements>
<style>...</style>
<output_format>...</output_format>
<verbosity>...</verbosity>
```

## Anti-Patterns

- **Modifying v1-baseline.ts**: Breaks A/B comparison baseline
- **Synonym substitution**: Prompts explicitly forbid - preserve user's exact terms
- **Summarizing context**: `<reference_material>` must copy verbatim
- **Missing persona integration**: Always apply `PERSONA_INSTRUCTIONS[personaId]`
