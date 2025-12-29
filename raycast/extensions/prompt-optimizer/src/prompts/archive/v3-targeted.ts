/**
 * ARCHIVED: v3-targeted.ts
 * Date: 2025-12-29
 * Result: FAILED A/B test vs v1-baseline
 *
 * Hypothesis: Explicit section-specific quality criteria (Role Derivation,
 * Objective Quality, Instructions Quality) would improve output quality.
 *
 * Results:
 *   - v1-baseline avg: 4.76
 *   - v3-targeted avg: 4.68 (-0.08, p=0.37)
 *   - Decision: KEEP BASELINE
 *
 * Why it failed:
 *   - Underperformed on system-design tasks (-0.33 avg)
 *   - design-001 (GitHub Actions audit) dropped from 5.0 to 4.0
 *   - Judge feedback: "do not specify depth of analysis or output schema
 *     details beyond section names, leaving minor ambiguity"
 *
 * Root cause analysis:
 *   The explicit constraints ("Number each step", "3-5 steps", "single
 *   measurable goal") were too rigid for complex tasks. v1-baseline's
 *   flexible "2-4 numbered steps" allowed the LLM to adapt output depth
 *   to task complexity. v3's prescriptive rules caused over-simplification.
 *
 * Lessons for future iterations:
 *   1. Avoid hard step counts - let LLM adapt to task complexity
 *   2. Don't constrain output structure too rigidly
 *   3. Focus quality criteria on WHAT to include, not HOW to format
 */

import { PERSONA_INSTRUCTIONS } from "../personas";
import { PromptStrategy } from "../types";

function buildPrompt(userPrompt: string, context?: string, personaId: string = "prompt_engineer"): string {
  const personaInstruction = PERSONA_INSTRUCTIONS[personaId] || PERSONA_INSTRUCTIONS["prompt_engineer"];

  return `<system>
${personaInstruction} Transform the user's request into a production-ready prompt.
</system>

<task>
Analyze the user's request${context ? " and provided context" : ""}, then create a well-structured prompt.
</task>

<rules>
- Output ONLY the optimized prompt using the XML tags below
- Do NOT wrap output in code fences or add meta-commentary

**Role Derivation**:
- Identify the specific domain (e.g., "backend security", not just "software engineering")
- Include expertise level appropriate to task complexity
- Match role to the actual work being requested

**Objective Quality**:
- State a single, measurable goal
- Include success criteria when possible
- Scope appropriately (not too broad, not too narrow)

**Instructions Quality**:
- Number each step (1, 2, 3...)
- Make each step actionable (starts with verb)
- Sequence logically (dependencies flow correctly)
- Include 3-5 steps for most tasks
${
  context
    ? `
**Context Preservation (CRITICAL)**:
- If <additional_context> contains code, logs, or data → copy VERBATIM to <reference_material>
- NEVER summarize, truncate, or paraphrase technical content
- Preserve exact terminology: tool names, paths, flags, user phrases
- "non-interactive" stays "non-interactive" (not "CLI mode")
- "bandaid fix" stays "bandaid fix" (not "temporary solution")`
    : ""
}
</rules>

<output_structure>
<role>You are an expert [specific domain] [professional/engineer/analyst]...</role>
<objective>[Single measurable goal with implicit success criteria]</objective>
<context>
- Audience: [Who consumes the output]
- Background: [Key assumptions]
</context>
<instructions>
1. [First actionable step]
2. [Second actionable step]
3. [Continue as needed]
</instructions>
${context ? `<reference_material>[VERBATIM copy of additional_context]</reference_material>` : ""}
<requirements>[2-4 bullets on content requirements]</requirements>
<style>[2-3 bullets on tone and format]</style>
<output_format>[Expected deliverable format]</output_format>
<verbosity>[concise/moderate/detailed]</verbosity>
</output_structure>

<user_request>
${userPrompt}
</user_request>
${
  context
    ? `
<additional_context>
${context}
</additional_context>`
    : ""
}
`;
}

export const v3Targeted: PromptStrategy = {
  id: "v3-targeted",
  name: "V3 Targeted",
  description:
    "Section-specific quality criteria for role/objective/instructions. Tests hypothesis that explicit guidance improves output quality.",
  buildPrompt,
};

export default v3Targeted;
export { buildPrompt };
