import { Icon } from "@raycast/api";
import { safeExec, getTimeout, parseGeminiJson } from "./exec";
import { getGeminiIsolation, getCodexIsolation } from "./isolation";
import { buildPrompt } from "../prompts/v1-baseline";
import { PERSONA_INSTRUCTIONS } from "../prompts/personas";
import { buildSmartPrompt, buildSmartAuditPrompt, buildSmartClarificationPrompt } from "../prompts/smart";

export { PERSONA_INSTRUCTIONS };

export interface Persona {
  id: string;
  title: string;
  icon: Icon;
}

export const PERSONAS: Persona[] = [
  { id: "prompt_engineer", title: "Prompt Engineer", icon: Icon.Wand },
  { id: "software_engineer", title: "Software Engineer", icon: Icon.Terminal },
  { id: "architect", title: "System Architect", icon: Icon.Building },
  { id: "devops", title: "DevOps Engineer", icon: Icon.Gear },
  { id: "security_auditor", title: "Security Auditor", icon: Icon.Lock },
  { id: "product_manager", title: "Product Manager", icon: Icon.Clipboard },
  { id: "data_scientist", title: "Data Scientist", icon: Icon.BarChart },
  { id: "content_writer", title: "Content Writer", icon: Icon.Pencil },
  { id: "researcher", title: "Researcher", icon: Icon.MagnifyingGlass },
];

export function buildOptimizationPrompt(
  userPrompt: string,
  context?: string,
  personaId: string = "prompt_engineer",
): string {
  return buildPrompt(userPrompt, context, personaId);
}

// THE CRITIC: Pass 1 (Audit)
function buildAuditPrompt(userPrompt: string, context?: string, personaId: string = "prompt_engineer"): string {
  return `<system>
You are an expert requirements analyst.
Analyze the user's request using the "${personaId}" persona lens.
Identify critical ambiguities, missing constraints, or vague requirements that prevent writing a perfect prompt.
Return specific clarifying questions.
</system>

<rules>
- You MUST return ONLY a JSON array of objects.
- Format: \`[{"id": "q1", "question": "..."}, ...]\`
- If the request is clear and needs no clarification, return an empty array \`[]\`.
- Maximum 5 questions.
- Do NOT output markdown formatting, code fences, or explanations. Just the raw JSON.
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

function buildClarificationPrompt(
  userPrompt: string,
  context: string | undefined,
  personaId: string,
  clarifications: { question: string; answer: string }[],
): string {
  const basePrompt = buildOptimizationPrompt(userPrompt, context, personaId);

  const clarificationBlock = `
<clarifications>
${clarifications.map((c) => `<item q="${c.question}" a="${c.answer}" />`).join("\n")}
</clarifications>

<instruction_update>
Incorporate the answers provided in <clarifications> to resolve the ambiguities in the original request.
</instruction_update>
`;

  return basePrompt.replace("<user_request>", `${clarificationBlock}\n<user_request>`);
}

export interface ClarificationQuestion {
  id: string;
  question: string;
}

export interface SmartModeResult {
  synthesis: string;
  perspectives: { persona: string; output: string }[];
  personasUsed: string[];
}

/**
 * Parse Smart Mode XML output into structured result.
 * Handles malformed output with graceful fallbacks.
 */
export function parseSmartModeOutput(raw: string): SmartModeResult {
  const personasMatch = raw.match(/<personas_used>([\s\S]*?)<\/personas_used>/);
  const personasUsed = personasMatch
    ? personasMatch[1]
        .trim()
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    : ["prompt_engineer"];

  const perspectiveRegex = /<perspective persona="([^"]+)">([\s\S]*?)<\/perspective>/g;
  const perspectives: { persona: string; output: string }[] = [];
  let match;
  while ((match = perspectiveRegex.exec(raw)) !== null) {
    perspectives.push({ persona: match[1].trim(), output: match[2].trim() });
  }

  const synthesisMatch = raw.match(/<synthesis>([\s\S]*?)<\/synthesis>/);
  const synthesis = synthesisMatch ? synthesisMatch[1].trim() : raw;

  // Fallback if parsing failed completely
  if (!synthesis && perspectives.length === 0) {
    return {
      synthesis: raw,
      perspectives: [{ persona: "prompt_engineer", output: raw }],
      personasUsed: ["prompt_engineer"],
    };
  }

  return { synthesis, perspectives, personasUsed };
}

/**
 * Parse Smart Audit JSON output into structured result.
 * Handles malformed output with graceful fallbacks.
 */
export function parseSmartAuditOutput(raw: string): { personasUsed: string[]; questions: ClarificationQuestion[] } {
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      personasUsed: parsed.personas_used || ["prompt_engineer"],
      questions: (parsed.questions || []).map((q: { id: string; question: string }) => ({
        id: q.id,
        question: q.question,
      })),
    };
  } catch {
    return { personasUsed: ["prompt_engineer"], questions: [] };
  }
}

export interface Engine {
  name: string;
  displayName: string;
  icon: Icon;
  defaultModel?: string;
  models?: { id: string; label: string }[];

  run: (prompt: string, model?: string, context?: string, personaId?: string) => Promise<string>;

  audit: (prompt: string, model?: string, context?: string, personaId?: string) => Promise<ClarificationQuestion[]>;
  runOrchestrated?: (prompt: string, model?: string, context?: string) => Promise<SmartModeResult>;
  runWithClarifications: (
    prompt: string,
    clarifications: { question: string; answer: string }[],
    model?: string,
    context?: string,
    personaId?: string,
  ) => Promise<string>;

  auditOrchestrated?: (
    prompt: string,
    model?: string,
    context?: string,
  ) => Promise<{ personasUsed: string[]; questions: ClarificationQuestion[] }>;

  runOrchestratedWithClarifications?: (
    prompt: string,
    clarifications: { question: string; answer: string }[],
    model?: string,
    context?: string,
  ) => Promise<SmartModeResult>;
}

export const engines: Engine[] = [
  {
    name: "gemini",
    displayName: "Gemini",
    icon: Icon.Stars,
    defaultModel: "gemini-3-flash-preview",
    models: [
      { id: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
      { id: "gemini-3-pro-preview", label: "Gemini 3 Pro" },
    ],
    run: async (prompt, model = "gemini-3-flash-preview", context = "", persona = "prompt_engineer") => {
      const timeout = getTimeout(false);
      const { env } = getGeminiIsolation();
      const output = await safeExec(
        "gemini",
        ["--model", model, "--output-format", "json"],
        buildOptimizationPrompt(prompt, context, persona),
        timeout,
        env,
      );
      return parseGeminiJson(output);
    },
    audit: async (prompt, model = "gemini-3-flash-preview", context = "", persona = "prompt_engineer") => {
      const { env } = getGeminiIsolation();
      const output = await safeExec(
        "gemini",
        ["--model", model, "--output-format", "json"],
        buildAuditPrompt(prompt, context, persona),
        undefined,
        env,
      );
      try {
        const response = parseGeminiJson(output);
        const jsonStr = response.replace(/```json\n?|\n?```/g, "").trim();
        return JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse audit JSON", e, output);
        return [];
      }
    },
    runWithClarifications: async (
      prompt,
      clarifications,
      model = "gemini-3-flash-preview",
      context = "",
      persona = "prompt_engineer",
    ) => {
      const { env } = getGeminiIsolation();
      const output = await safeExec(
        "gemini",
        ["--model", model, "--output-format", "json"],
        buildClarificationPrompt(prompt, context, persona, clarifications),
        undefined,
        env,
      );
      return parseGeminiJson(output);
    },
    runOrchestrated: async (prompt, model = "gemini-3-flash-preview", context = "") => {
      const timeout = getTimeout(true);
      const { env } = getGeminiIsolation();
      const output = await safeExec(
        "gemini",
        ["--model", model, "--output-format", "json"],
        buildSmartPrompt(prompt, context),
        timeout,
        env,
      );
      return parseSmartModeOutput(parseGeminiJson(output));
    },
    auditOrchestrated: async (prompt, model = "gemini-3-flash-preview", context = "") => {
      const timeout = getTimeout(true);
      const { env } = getGeminiIsolation();
      const output = await safeExec(
        "gemini",
        ["--model", model, "--output-format", "json"],
        buildSmartAuditPrompt(prompt, context),
        timeout,
        env,
      );
      return parseSmartAuditOutput(parseGeminiJson(output));
    },
    runOrchestratedWithClarifications: async (
      prompt,
      clarifications,
      model = "gemini-3-flash-preview",
      context = "",
    ) => {
      const timeout = getTimeout(true);
      const { env } = getGeminiIsolation();
      const output = await safeExec(
        "gemini",
        ["--model", model, "--output-format", "json"],
        buildSmartClarificationPrompt(prompt, context, clarifications),
        timeout,
        env,
      );
      return parseSmartModeOutput(parseGeminiJson(output));
    },
  },
  {
    name: "codex",
    displayName: "Codex",
    icon: Icon.Code,
    defaultModel: "gpt-5.2-codex",
    models: [{ id: "gpt-5.2-codex", label: "gpt-5.2-codex" }],
    run: async (prompt, model = "gpt-5.2-codex", context = "", persona = "prompt_engineer") => {
      const timeout = getTimeout(false);
      const { env } = getCodexIsolation();
      return safeExec(
        "codex",
        ["exec", "-m", model, "--config", `model_reasoning_effort="high"`, "--skip-git-repo-check"],
        buildOptimizationPrompt(prompt, context, persona),
        timeout,
        env,
      );
    },
    audit: async (prompt, model = "gpt-5.2-codex", context = "", persona = "prompt_engineer") => {
      const { env } = getCodexIsolation();
      const result = await safeExec(
        "codex",
        ["exec", "-m", model, "--config", `model_reasoning_effort="high"`, "--skip-git-repo-check"],
        buildAuditPrompt(prompt, context, persona),
        undefined,
        env,
      );
      try {
        const jsonStr = result.replace(/```json\n?|\n?```/g, "").trim();
        return JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse audit JSON", e, result);
        return [];
      }
    },
    runWithClarifications: async (
      prompt,
      clarifications,
      model = "gpt-5.2-codex",
      context = "",
      persona = "prompt_engineer",
    ) => {
      const { env } = getCodexIsolation();
      return safeExec(
        "codex",
        ["exec", "-m", model, "--config", `model_reasoning_effort="high"`, "--skip-git-repo-check"],
        buildClarificationPrompt(prompt, context, persona, clarifications),
        undefined,
        env,
      );
    },
    runOrchestrated: async (prompt, model = "gpt-5.2-codex", context = "") => {
      const timeout = getTimeout(true);
      const { env } = getCodexIsolation();
      const output = await safeExec(
        "codex",
        ["exec", "-m", model, "--config", `model_reasoning_effort="high"`, "--skip-git-repo-check"],
        buildSmartPrompt(prompt, context),
        timeout,
        env,
      );
      return parseSmartModeOutput(output);
    },
    auditOrchestrated: async (prompt, model = "gpt-5.2-codex", context = "") => {
      const timeout = getTimeout(true);
      const { env } = getCodexIsolation();
      const output = await safeExec(
        "codex",
        ["exec", "-m", model, "--config", `model_reasoning_effort="high"`, "--skip-git-repo-check"],
        buildSmartAuditPrompt(prompt, context),
        timeout,
        env,
      );
      return parseSmartAuditOutput(output);
    },
    runOrchestratedWithClarifications: async (prompt, clarifications, model = "gpt-5.2-codex", context = "") => {
      const timeout = getTimeout(true);
      const { env } = getCodexIsolation();
      const output = await safeExec(
        "codex",
        ["exec", "-m", model, "--config", `model_reasoning_effort="high"`, "--skip-git-repo-check"],
        buildSmartClarificationPrompt(prompt, context, clarifications),
        timeout,
        env,
      );
      return parseSmartModeOutput(output);
    },
  },
];
