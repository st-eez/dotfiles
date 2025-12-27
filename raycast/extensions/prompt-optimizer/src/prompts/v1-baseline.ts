/**
 * V1 Baseline Prompt Strategy
 *
 * FROZEN: Do not modify after creation.
 * This serves as the baseline for A/B testing future improvements.
 *
 * Extracted from engines.ts on 2025-12-26.
 */

import { PERSONA_INSTRUCTIONS } from "./personas";
import { PromptStrategy } from "./types";

/**
 * Quick mode: Comprehensive single-shot prompt in XML format
 */
function buildQuickPrompt(userPrompt: string, context?: string, personaId: string = "prompt_engineer"): string {
  const personaInstruction = PERSONA_INSTRUCTIONS[personaId] || PERSONA_INSTRUCTIONS["prompt_engineer"];

  return `<system>
${personaInstruction} Transform the user's request into a comprehensive, production-ready prompt.
</system>

<task>
Analyze the user's request ${context ? "and the provided context" : ""}, identify the domain and audience, then create a well-structured prompt that will produce high-quality results.
</task>

<rules>
- Output ONLY the optimized prompt using the XML structure shown in output_format
- Do NOT include the output_format wrapper tags - only output the inner tags
- Derive the specific domain from the request
- Include 2-4 bullet points per section
- Be thorough but concise
- No explanations or meta-commentary
- No code fences
${
  context
    ? `- **Adaptive Context**: Analyze the <additional_context>. If it contains raw data, logs, or code, you MUST copy it VERBATIM into a <reference_material> section—do NOT summarize or truncate. If it contains instructions/preferences, incorporate them into <instructions> or <style>.
- **Verbatim Preservation (CRITICAL)**: The user's exact terminology from <additional_context> MUST appear in your output unchanged.
  - Tool names, file paths, branch names, CLI flags → copy exactly
  - Phrases like "root issues", "bandaid fixes", "non-interactive", "sub agents" → copy exactly
  NEVER substitute with synonyms ("non-interactive" ≠ "CLI mode", "bandaid" ≠ "temporary").
  The user's wording is intentional—preserve it.`
    : ""
}
</rules>

<output_format>
<role>You are an expert [derived domain] professional... ${personaId !== "prompt_engineer" ? `[Incorporating ${personaId} lens]` : ""}</role>

<objective>[Clear, specific goal statement]</objective>

<context>
- Audience: [Who will consume the output]
- Background: [Relevant assumptions]
</context>

<instructions>
[2-4 numbered steps]
</instructions>

${
  context
    ? `<reference_material>
[COPY THE FULL <additional_context> VERBATIM HERE - do NOT summarize]
</reference_material>`
    : ""
}\\n
<requirements>
[2-4 bullets on content requirements]
</requirements>

<style>
[2-3 bullets on tone, format]
</style>

<output_format>[Expected format]</output_format>

<verbosity>[Concise/moderate/detailed]</verbosity>
</output_format>

<user_request>
${userPrompt}
</user_request>

${
  context
    ? `<additional_context>
${context}
</additional_context>`
    : ""
}
`;
}

/**
 * Detailed mode: Comprehensive phased prompt with checkpoints
 */
function buildDetailedPrompt(userPrompt: string, context?: string, personaId: string = "prompt_engineer"): string {
  const personaInstruction = PERSONA_INSTRUCTIONS[personaId] || PERSONA_INSTRUCTIONS["prompt_engineer"];

  return `<system>
${personaInstruction} Create a comprehensive, production-ready prompt with clear phases and approval checkpoints.
</system>

<rules>
- Output ONLY the optimized prompt using the XML structure shown in output_format
- Do NOT include the output_format wrapper tags - only output the inner tags
- Break complex work into 2-4 logical phases
- Each phase must have a clear deliverable and checkpoint
${
  context
    ? `- **Adaptive Context**: Analyze the <additional_context>. If it contains raw data, logs, or code, you MUST copy it VERBATIM into a <reference_material> section—do NOT summarize or truncate. If it contains instructions/preferences, incorporate them into <instructions>.
- **Verbatim Preservation (CRITICAL)**: The user's exact terminology from <additional_context> MUST appear in your output unchanged.
  - Tool names, file paths, branch names, CLI flags → copy exactly
  - Phrases like "root issues", "bandaid fixes", "non-interactive", "sub agents" → copy exactly
  NEVER substitute synonyms. The user's wording is intentional.`
    : ""
}
</rules>

<output_format>
<role>You are an expert [derived domain]...</role>
<objective>[Clear, specific goal]</objective>
<execution_protocol>Complete sequentially. Wait for approval at checkpoints.</execution_protocol>

<phase id="1">
  <goal>[Phase Goal]</goal>
  <steps>[Actions]</steps>
  <deliverable>[Output]</deliverable>
  <checkpoint>Present deliverable and await approval.</checkpoint>
</phase>

[Phase 2...]

${context ? `<reference_material>[COPY THE FULL <additional_context> VERBATIM HERE - do NOT summarize]</reference_material>` : ""}
</output_format>

<user_request>
${userPrompt}
</user_request>

${
  context
    ? `<additional_context>
${context}
</additional_context>`
    : ""
}
`;
}

export const v1Baseline: PromptStrategy = {
  id: "v1-baseline",
  name: "V1 Baseline",
  description: "Original prompt strategy extracted from engines.ts. Frozen baseline for A/B testing.",
  buildQuickPrompt,
  buildDetailedPrompt,
};

// Named exports for direct import compatibility with engines.ts
export { buildQuickPrompt, buildDetailedPrompt };
