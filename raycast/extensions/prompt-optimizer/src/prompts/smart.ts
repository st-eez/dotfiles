import { PERSONA_INSTRUCTIONS } from "./personas";

export function buildSmartPrompt(userPrompt: string, context?: string): string {
  const personaList = Object.entries(PERSONA_INSTRUCTIONS)
    .map(([id, instruction]) => `- ${id}: ${instruction}`)
    .join("\n");

  const contextRules = context
    ? `- Preserve <additional_context> VERBATIM in <reference_material>—do NOT summarize
- Preserve exact terminology: tool names, paths, CLI flags, quoted phrases`
    : "";

  const synthesisTemplate = `<synthesis>
      <role>You are an expert [domain]...</role>
      <objective>[Merged goal]</objective>
      <context>[Audience/background]</context>
      <instructions>[2-4 steps]</instructions>
      <requirements>[Key requirements]</requirements>
      <style>[Tone/format]</style>
      <output_format>[Expected output]</output_format>
    </synthesis>`;

  // Data-first ordering: user_request → context → personas → rules → output_format
  return `<system>
You are an expert multi-persona prompt optimizer.
</system>

<user_request>
${userPrompt}
</user_request>

${context ? `<additional_context>\n${context}\n</additional_context>\n` : ""}<available_personas>
${personaList}
</available_personas>

<rules>
- Select 2-3 relevant personas from <available_personas>
- Generate COMPLETE optimized prompt from each persona
- Synthesize into unified prompt with required tags: <role>, <objective>, <instructions>
- Resolve conflicts by choosing the more specific option
${contextRules}
- Output ONLY the XML shown below
</rules>

<output_format>
<smart_mode_result>
  <personas_used>id1,id2</personas_used>

  <perspective persona="id1">
    <role>...</role>
    <objective>...</objective>
    <instructions>...</instructions>
  </perspective>

  <perspective persona="id2">
    <role>...</role>
    <objective>...</objective>
    <instructions>...</instructions>
  </perspective>

  ${synthesisTemplate}
</smart_mode_result>
</output_format>
`;
}

export function buildSmartAuditPrompt(userPrompt: string, context?: string): string {
  const personaList = Object.entries(PERSONA_INSTRUCTIONS)
    .map(([id, instruction]) => `- ${id}: ${instruction}`)
    .join("\n");

  return `<system>
You are an expert multi-persona requirements analyst.
</system>

<user_request>
${userPrompt}
</user_request>

${context ? `<additional_context>\n${context}\n</additional_context>\n` : ""}<available_personas>
${personaList}
</available_personas>

<rules>
- Select 2-3 relevant personas from <available_personas>
- Each persona identifies ambiguities from their expert lens
- Maximum 2 questions per persona (up to 6 total if 3 personas)
- Deduplicate overlapping questions
- Return ONLY questions that would materially change the optimized prompt
- Output ONLY the JSON shown below
</rules>

<output_format>
{
  "personas_used": ["id1", "id2"],
  "questions": [
    {"id": "q1", "persona": "id1", "question": "..."},
    {"id": "q2", "persona": "id2", "question": "..."}
  ]
}
</output_format>
`;
}

export function buildSmartClarificationPrompt(
  userPrompt: string,
  context: string | undefined,
  clarifications: { question: string; answer: string }[],
): string {
  const basePrompt = buildSmartPrompt(userPrompt, context);

  const clarificationBlock = `
<clarifications>
${clarifications.map((c) => `<item q="${c.question}" a="${c.answer}" />`).join("\n")}
</clarifications>

<instruction_update>
Incorporate the answers from <clarifications> to resolve ambiguities.
IMPORTANT: You MUST still output the FULL <smart_mode_result> XML with <personas_used>, <perspective> for each persona, and <synthesis>.
</instruction_update>
`;

  // Insert BEFORE <available_personas> to maintain data-first ordering
  return basePrompt.replace("<available_personas>", `${clarificationBlock}\n<available_personas>`);
}
