/**
 * V2 Lean Prompt Strategy
 *
 * EXPERIMENT: Token reduction for faster response times
 *
 * Hypothesis: Reducing prompt verbosity by 40-50% will decrease latency
 * by 30-40% while maintaining output quality.
 *
 * Changes from v1-baseline:
 * 1. Reduced <rules> from 11 → 6 bullets
 * 2. Collapsed <output_format> skeleton to compact reference
 * 3. Shortened context handling instructions
 * 4. Removed redundant/obvious instructions
 */

import { PERSONA_INSTRUCTIONS } from "./personas";
import { PromptStrategy } from "./types";

/**
 * Quick mode: Lean single-shot prompt
 */
function buildQuickPrompt(userPrompt: string, context?: string, personaId: string = "prompt_engineer"): string {
  const personaInstruction = PERSONA_INSTRUCTIONS[personaId] || PERSONA_INSTRUCTIONS["prompt_engineer"];

  return `<system>
${personaInstruction}
</system>

<task>
Transform this request into a structured, actionable prompt.
</task>

<rules>
- Output ONLY the optimized prompt in XML format
- Use these tags: <role>, <objective>, <context>, <instructions>, <requirements>, <style>, <output_format>, <verbosity>
- Be specific and concise
${
  context
    ? `- Context containing code/logs/data → copy VERBATIM to <reference_material>
- Preserve exact terminology: tool names, paths, CLI flags, user phrases`
    : ""
}
</rules>

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
 * Detailed mode: Lean phased prompt
 */
function buildDetailedPrompt(userPrompt: string, context?: string, personaId: string = "prompt_engineer"): string {
  const personaInstruction = PERSONA_INSTRUCTIONS[personaId] || PERSONA_INSTRUCTIONS["prompt_engineer"];

  return `<system>
${personaInstruction}
</system>

<task>
Create a phased prompt with approval checkpoints.
</task>

<rules>
- Output XML with: <role>, <objective>, <execution_protocol>, <phase id="N"> containing <goal>, <steps>, <deliverable>, <checkpoint>
- Break into 2-4 phases with clear deliverables
${
  context
    ? `- Context containing code/logs/data → copy VERBATIM to <reference_material>
- Preserve exact terminology from context`
    : ""
}
</rules>

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

export const v2Lean: PromptStrategy = {
  id: "v2-lean",
  name: "V2 Lean",
  description:
    "Token-reduced prompts for faster response times. Tests hypothesis that concise prompts maintain quality.",
  buildQuickPrompt,
  buildDetailedPrompt,
};

// Default export for dynamic import
export default v2Lean;

// Named exports for compatibility
export { buildQuickPrompt, buildDetailedPrompt };
