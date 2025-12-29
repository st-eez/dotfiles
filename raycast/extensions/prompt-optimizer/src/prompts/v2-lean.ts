import { PERSONA_INSTRUCTIONS } from "./personas";
import { PromptStrategy } from "./types";

function buildPrompt(userPrompt: string, context?: string, personaId: string = "prompt_engineer"): string {
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

export const v2Lean: PromptStrategy = {
  id: "v2-lean",
  name: "V2 Lean",
  description:
    "Token-reduced prompts for faster response times. Tests hypothesis that concise prompts maintain quality.",
  buildPrompt,
};

export default v2Lean;
export { buildPrompt };
