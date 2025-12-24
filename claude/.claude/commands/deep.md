---
description: Deep analysis with parallel sub-agents and source validation
model: claude-opus-4-5-20251101
argument-hint: <question, analysis, or research request>
---

Ultrathink. Reason through this step-by-step before concluding.

## Verification Process

1. **Gather evidence first** - Use these tools before forming conclusions:
   - **Library/framework questions** → Use Context7 MCP: call `resolve-library-id` then `get-library-docs`
   - **Best practices/comparisons** → Use WebSearch tool for current 2025 sources
   - **Codebase analysis** → Deploy Explore sub-agents in parallel (one per module/directory). Do NOT read large files directly into this context.
   - **Multi-faceted research** → Deploy parallel research sub-agents for different aspects

2. **Ground claims in evidence**: For each claim you make:
   - Base it on evidence gathered (Context7 docs, web search results, sub-agent findings), not general knowledge
   - Note the source (doc, search result, file, sub-agent findings)
   - If you cannot find supporting evidence, do not make the claim

3. **Acknowledge uncertainty**: If information is:
   - Incomplete → say what's missing
   - Conflicting → present both positions
   - Outside your knowledge → say "I don't know" rather than guess

## Response Format

- Lead with your conclusion/recommendation
- Follow with the evidence that supports it
- Note any caveats, limitations, or areas of uncertainty
- List sources used

$ARGUMENTS
