import { Icon } from "@raycast/api";
import { safeExec, getTimeout, parseGeminiJson, withIsolatedGemini, withIsolatedCodex } from "./exec";
// Current production strategy - update this import when promoting a new A/B test winner
import { buildQuickPrompt, buildDetailedPrompt } from "../prompts/v1-baseline";
import { PERSONA_INSTRUCTIONS } from "../prompts/personas";
import { buildSmartPrompt, buildSmartAuditPrompt, buildSmartClarificationPrompt } from "../prompts/smart";

// Re-export for external consumers
export { PERSONA_INSTRUCTIONS };

// Optimization mode types and configuration
export type OptimizationMode = "quick" | "detailed";

export interface OptimizationModeConfig {
  id: OptimizationMode;
  label: string;
  description: string;
}

export const OPTIMIZATION_MODES: OptimizationModeConfig[] = [
  { id: "quick", label: "Quick", description: "Comprehensive single-shot prompt" },
  { id: "detailed", label: "Detailed", description: "Phased execution with checkpoints" },
];

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

// Dispatcher function
export function buildOptimizationPrompt(
  userPrompt: string,
  mode: OptimizationMode = "quick",
  context?: string,
  personaId: string = "prompt_engineer",
): string {
  switch (mode) {
    case "quick":
      return buildQuickPrompt(userPrompt, context, personaId);
    case "detailed":
      return buildDetailedPrompt(userPrompt, context, personaId);
    default:
      return buildQuickPrompt(userPrompt, context, personaId);
  }
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

// THE CRITIC: Pass 2 (Synthesis)
function buildClarificationPrompt(
  userPrompt: string,
  mode: OptimizationMode,
  context: string | undefined,
  personaId: string,
  clarifications: { question: string; answer: string }[],
): string {
  const basePrompt = buildOptimizationPrompt(userPrompt, mode, context, personaId);

  // We inject the clarifications into the task description or a special section
  const clarificationBlock = `
<clarifications>
${clarifications.map((c) => `<item q="${c.question}" a="${c.answer}" />`).join("\n")}
</clarifications>

<instruction_update>
Incorporate the answers provided in <clarifications> to resolve the ambiguities in the original request.
</instruction_update>
`;

  // Insert before <user_request>
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

  // Standard run
  run: (
    prompt: string,
    model?: string,
    mode?: OptimizationMode,
    context?: string,
    personaId?: string,
  ) => Promise<string>;

  // Critic Actions
  audit: (prompt: string, model?: string, context?: string, personaId?: string) => Promise<ClarificationQuestion[]>;
  runOrchestrated?: (
    prompt: string,
    model?: string,
    mode?: OptimizationMode,
    context?: string,
  ) => Promise<SmartModeResult>;
  runWithClarifications: (
    prompt: string,
    clarifications: { question: string; answer: string }[],
    model?: string,
    mode?: OptimizationMode,
    context?: string,
    personaId?: string,
  ) => Promise<string>;

  // Smart Mode Critic Actions
  auditOrchestrated?: (
    prompt: string,
    model?: string,
    context?: string,
  ) => Promise<{ personasUsed: string[]; questions: ClarificationQuestion[] }>;

  runOrchestratedWithClarifications?: (
    prompt: string,
    clarifications: { question: string; answer: string }[],
    model?: string,
    mode?: OptimizationMode,
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
    run: async (
      prompt,
      model = "gemini-3-flash-preview",
      mode = "quick",
      context = "",
      persona = "prompt_engineer",
    ) => {
      const timeout = getTimeout(mode, false);
      return withIsolatedGemini(async (homeDir) => {
        const output = await safeExec(
          "gemini",
          ["--model", model, "--output-format", "json"],
          buildOptimizationPrompt(prompt, mode, context, persona),
          timeout,
          { HOME: homeDir },
        );
        return parseGeminiJson(output);
      });
    },
    audit: async (prompt, model = "gemini-3-flash-preview", context = "", persona = "prompt_engineer") => {
      return withIsolatedGemini(async (homeDir) => {
        const output = await safeExec(
          "gemini",
          ["--model", model, "--output-format", "json"],
          buildAuditPrompt(prompt, context, persona),
          undefined,
          { HOME: homeDir },
        );
        try {
          const response = parseGeminiJson(output);
          const jsonStr = response.replace(/```json\n?|\n?```/g, "").trim();
          return JSON.parse(jsonStr);
        } catch (e) {
          console.error("Failed to parse audit JSON", e, output);
          return [];
        }
      });
    },
    runWithClarifications: async (
      prompt,
      clarifications,
      model = "gemini-3-flash-preview",
      mode = "quick",
      context = "",
      persona = "prompt_engineer",
    ) => {
      return withIsolatedGemini(async (homeDir) => {
        const output = await safeExec(
          "gemini",
          ["--model", model, "--output-format", "json"],
          buildClarificationPrompt(prompt, mode, context, persona, clarifications),
          undefined,
          { HOME: homeDir },
        );
        return parseGeminiJson(output);
      });
    },
    runOrchestrated: async (prompt, model = "gemini-3-flash-preview", mode = "quick", context = "") => {
      // Solo Performance Prompting: single call handles persona selection, perspectives, and synthesis
      const timeout = getTimeout(mode, true);
      return withIsolatedGemini(async (homeDir) => {
        const output = await safeExec(
          "gemini",
          ["--model", model, "--output-format", "json"],
          buildSmartPrompt(prompt, context, mode),
          timeout,
          { HOME: homeDir },
        );
        return parseSmartModeOutput(parseGeminiJson(output));
      });
    },
    auditOrchestrated: async (prompt, model = "gemini-3-flash-preview", context = "") => {
      return withIsolatedGemini(async (homeDir) => {
        const output = await safeExec(
          "gemini",
          ["--model", model, "--output-format", "json"],
          buildSmartAuditPrompt(prompt, context),
          undefined,
          { HOME: homeDir },
        );
        return parseSmartAuditOutput(parseGeminiJson(output));
      });
    },
    runOrchestratedWithClarifications: async (
      prompt,
      clarifications,
      model = "gemini-3-flash-preview",
      mode = "quick",
      context = "",
    ) => {
      const timeout = getTimeout(mode, true);
      return withIsolatedGemini(async (homeDir) => {
        const output = await safeExec(
          "gemini",
          ["--model", model, "--output-format", "json"],
          buildSmartClarificationPrompt(prompt, context, clarifications, mode),
          timeout,
          { HOME: homeDir },
        );
        return parseSmartModeOutput(parseGeminiJson(output));
      });
    },
  },
  {
    name: "codex",
    displayName: "Codex",
    icon: Icon.Code,
    defaultModel: "gpt-5.2-codex",
    models: [{ id: "gpt-5.2-codex", label: "gpt-5.2-codex" }],
    run: async (prompt, model = "gpt-5.2-codex", mode = "quick", context = "", persona = "prompt_engineer") => {
      const timeout = getTimeout(mode, false);
      return withIsolatedCodex(async (homeDir) => {
        return safeExec(
          "codex",
          ["exec", "-m", model, "--config", `model_reasoning_effort="high"`, "--skip-git-repo-check"],
          buildOptimizationPrompt(prompt, mode, context, persona),
          timeout,
          { CODEX_HOME: homeDir },
        );
      });
    },
    audit: async (prompt, model = "gpt-5.2-codex", context = "", persona = "prompt_engineer") => {
      return withIsolatedCodex(async (homeDir) => {
        const result = await safeExec(
          "codex",
          ["exec", "-m", model, "--config", `model_reasoning_effort="high"`, "--skip-git-repo-check"],
          buildAuditPrompt(prompt, context, persona),
          undefined, // Use default timeout
          { CODEX_HOME: homeDir },
        );
        try {
          // Clean up markdown fences if present
          const jsonStr = result.replace(/```json\n?|\n?```/g, "").trim();
          return JSON.parse(jsonStr);
        } catch (e) {
          console.error("Failed to parse audit JSON", e, result);
          return [];
        }
      });
    },
    runWithClarifications: async (
      prompt,
      clarifications,
      model = "gpt-5.2-codex",
      mode = "quick",
      context = "",
      persona = "prompt_engineer",
    ) => {
      return withIsolatedCodex(async (homeDir) => {
        return safeExec(
          "codex",
          ["exec", "-m", model, "--config", `model_reasoning_effort="high"`, "--skip-git-repo-check"],
          buildClarificationPrompt(prompt, mode, context, persona, clarifications),
          undefined,
          { CODEX_HOME: homeDir },
        );
      });
    },
    runOrchestrated: async (prompt, model = "gpt-5.2-codex", mode = "quick", context = "") => {
      // Solo Performance Prompting for Codex
      const timeout = getTimeout(mode, true);
      return withIsolatedCodex(async (homeDir) => {
        const output = await safeExec(
          "codex",
          ["exec", "-m", model, "--config", `model_reasoning_effort="high"`, "--skip-git-repo-check"],
          buildSmartPrompt(prompt, context, mode),
          timeout,
          { CODEX_HOME: homeDir },
        );
        return parseSmartModeOutput(output);
      });
    },
    auditOrchestrated: async (prompt, model = "gpt-5.2-codex", context = "") => {
      return withIsolatedCodex(async (homeDir) => {
        const output = await safeExec(
          "codex",
          ["exec", "-m", model, "--config", `model_reasoning_effort="high"`, "--skip-git-repo-check"],
          buildSmartAuditPrompt(prompt, context),
          undefined,
          { CODEX_HOME: homeDir },
        );
        return parseSmartAuditOutput(output);
      });
    },
    runOrchestratedWithClarifications: async (
      prompt,
      clarifications,
      model = "gpt-5.2-codex",
      mode = "quick",
      context = "",
    ) => {
      const timeout = getTimeout(mode, true);
      return withIsolatedCodex(async (homeDir) => {
        const output = await safeExec(
          "codex",
          ["exec", "-m", model, "--config", `model_reasoning_effort="high"`, "--skip-git-repo-check"],
          buildSmartClarificationPrompt(prompt, context, clarifications, mode),
          timeout,
          { CODEX_HOME: homeDir },
        );
        return parseSmartModeOutput(output);
      });
    },
  },
  // Claude engine disabled due to known authentication bug in Claude Code CLI
  // Non-interactive mode (-p) fails with "Invalid API key" even when logged in
  // See: https://github.com/anthropics/claude-code/issues/5666
  // Uncomment when fixed
  /*
  {
    name: "claude",
    displayName: "Claude",
    defaultModel: "sonnet",
    models: [
      { id: "sonnet", label: "Sonnet" },
      { id: "haiku", label: "Haiku" },
      { id: "opus", label: "Opus" },
    ],
    run: async (prompt, model = "sonnet", mode = "quick") => {
      // Claude: Run in login shell to access Keychain/Env vars
      return safeExec("/bin/zsh", ["-l", "-c", `cat | claude -p --model ${model}`], buildOptimizationPrompt(prompt, mode));
    },
  },
  */
];
