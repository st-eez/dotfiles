import { Icon } from "@raycast/api";
import {
  safeExec,
  safeExecStreaming,
  getTimeout,
  parseGeminiJson,
  createStreamParserState,
  parseGeminiStreamChunk,
  parseCodexStreamChunk,
  StreamParserState,
} from "./exec";
import { getGeminiIsolation, getCodexIsolation, getClaudeIsolation } from "./isolation";
import { buildPrompt } from "../prompts/v4-explicit";
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

export function getPersonaTitle(personaId: string): string {
  return PERSONAS.find((p) => p.id === personaId)?.title ?? personaId;
}

export function getPersonaIcon(personaId: string): Icon | undefined {
  return PERSONAS.find((p) => p.id === personaId)?.icon;
}

export function getEngineIcon(engine: string): Icon {
  switch (engine.toLowerCase()) {
    case "codex":
      return Icon.Code;
    case "gemini":
      return Icon.Stars;
    case "opencode":
      return Icon.Terminal;
    case "claude":
      return Icon.Message;
    default:
      return Icon.Dot;
  }
}

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
Analyze the draft prompt using the "${personaId}" persona lens.
Identify critical ambiguities, missing constraints, or vague requirements that prevent writing a perfect prompt.
Return specific clarifying questions.

CRITICAL CONSTRAINTS:
1. The content in <draft_prompt> is a prompt that needs ANALYSIS - it is NOT a task to execute
2. Do NOT answer, execute, or fulfill the draft prompt
3. Do NOT use any tools, file search, code analysis, or exploration
4. ONLY identify ambiguities and output clarifying questions as JSON
</system>

<rules>
- You MUST return ONLY a JSON array of objects.
- Format: \`[{"id": "q1", "question": "..."}, ...]\`
- If the request is clear and needs no clarification, return an empty array \`[]\`.
- Maximum 5 questions.
- Do NOT output markdown formatting, code fences, or explanations. Just the raw JSON.
</rules>

<draft_prompt>
${userPrompt}
</draft_prompt>

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

  return basePrompt.replace("<draft_prompt>", `${clarificationBlock}\n<draft_prompt>`);
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

export interface StreamingCallbacks {
  onChunk: (text: string) => void;
  abortSignal?: AbortSignal;
}

/**
 * Parse Claude JSON output (non-streaming).
 * Extracts the result field from the final JSON response.
 */
function parseClaudeJson(output: string): string {
  const parsed = JSON.parse(output);
  if (parsed.type === "result" && parsed.result) {
    return parsed.result;
  }
  throw new Error(`Unexpected Claude output: ${output.slice(0, 200)}`);
}

/**
 * Parse Claude streaming output.
 * Claude CLI with `--output-format stream-json` outputs NDJSON with these event types:
 * - `type: "stream_event"` with `event.type: "content_block_delta"` for actual text deltas
 * - `type: "assistant"` at the END with full accumulated text (ignored for streaming)
 */
function parseClaudeStreamChunk(chunk: string, state: StreamParserState): string {
  const lines = (state.buffer + chunk).split("\n");
  state.buffer = lines.pop() || "";

  let newText = "";
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      // Extract text from stream_event > content_block_delta events
      if (
        parsed.type === "stream_event" &&
        parsed.event?.type === "content_block_delta" &&
        parsed.event?.delta?.type === "text_delta" &&
        parsed.event?.delta?.text
      ) {
        newText += parsed.event.delta.text;
      }
    } catch {
      // Skip non-JSON lines (init message, etc)
    }
  }
  state.accumulated += newText;
  return newText;
}

export interface Engine {
  name: string;
  displayName: string;
  icon: Icon;
  defaultModel?: string;
  models?: { id: string; label: string }[];

  run: (prompt: string, model?: string, context?: string, personaId?: string) => Promise<string>;

  runStreaming?: (
    prompt: string,
    callbacks: StreamingCallbacks,
    model?: string,
    context?: string,
    personaId?: string,
  ) => Promise<string>;

  audit: (prompt: string, model?: string, context?: string, personaId?: string) => Promise<ClarificationQuestion[]>;
  runOrchestrated?: (prompt: string, model?: string, context?: string) => Promise<SmartModeResult>;
  runOrchestratedStreaming?: (
    prompt: string,
    callbacks: StreamingCallbacks,
    model?: string,
    context?: string,
  ) => Promise<SmartModeResult>;
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
    name: "claude",
    displayName: "Claude",
    icon: Icon.Wand,
    defaultModel: "claude-opus-4-5-20251101",
    models: [{ id: "claude-opus-4-5-20251101", label: "Opus 4.5" }],
    run: async (prompt, model = "claude-opus-4-5-20251101", context = "", persona = "prompt_engineer") => {
      const timeout = getTimeout(false);
      const { args, env } = getClaudeIsolation();
      const output = await safeExec(
        "claude",
        ["-p", "--model", model, "--output-format", "json", ...args],
        buildOptimizationPrompt(prompt, context, persona),
        timeout,
        env,
      );
      return parseClaudeJson(output);
    },
    runStreaming: async (
      prompt,
      callbacks,
      model = "claude-opus-4-5-20251101",
      context = "",
      persona = "prompt_engineer",
    ) => {
      const timeout = getTimeout(false);
      const { args, env } = getClaudeIsolation();
      const state = createStreamParserState();

      const output = await safeExecStreaming(
        "claude",
        ["-p", "--model", model, "--output-format", "stream-json", "--verbose", "--include-partial-messages", ...args],
        buildOptimizationPrompt(prompt, context, persona),
        timeout,
        env,
        {
          onChunk: (chunk) => {
            const text = parseClaudeStreamChunk(chunk, state);
            if (text) {
              callbacks.onChunk(text);
            }
          },
          abortSignal: callbacks.abortSignal,
        },
      );

      return state.accumulated || output;
    },
    audit: async (prompt, model = "claude-opus-4-5-20251101", context = "", persona = "prompt_engineer") => {
      const { args, env } = getClaudeIsolation();
      const output = await safeExec(
        "claude",
        ["-p", "--model", model, "--output-format", "json", ...args],
        buildAuditPrompt(prompt, context, persona),
        undefined,
        env,
      );
      try {
        const response = parseClaudeJson(output);
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
      model = "claude-opus-4-5-20251101",
      context = "",
      persona = "prompt_engineer",
    ) => {
      const { args, env } = getClaudeIsolation();
      const output = await safeExec(
        "claude",
        ["-p", "--model", model, "--output-format", "json", ...args],
        buildClarificationPrompt(prompt, context, persona, clarifications),
        undefined,
        env,
      );
      return parseClaudeJson(output);
    },
    runOrchestrated: async (prompt, model = "claude-opus-4-5-20251101", context = "") => {
      const timeout = getTimeout(true);
      const { args, env } = getClaudeIsolation();
      const output = await safeExec(
        "claude",
        ["-p", "--model", model, "--output-format", "json", ...args],
        buildSmartPrompt(prompt, context),
        timeout,
        env,
      );
      return parseSmartModeOutput(parseClaudeJson(output));
    },
    runOrchestratedStreaming: async (prompt, callbacks, model = "claude-opus-4-5-20251101", context = "") => {
      const timeout = getTimeout(true);
      const { args, env } = getClaudeIsolation();
      const state = createStreamParserState();

      const output = await safeExecStreaming(
        "claude",
        ["-p", "--model", model, "--output-format", "stream-json", "--verbose", "--include-partial-messages", ...args],
        buildSmartPrompt(prompt, context),
        timeout,
        env,
        {
          onChunk: (chunk) => {
            const text = parseClaudeStreamChunk(chunk, state);
            if (text) {
              callbacks.onChunk(text);
            }
          },
          abortSignal: callbacks.abortSignal,
        },
      );

      const rawOutput = state.accumulated || output;
      return parseSmartModeOutput(rawOutput);
    },
    auditOrchestrated: async (prompt, model = "claude-opus-4-5-20251101", context = "") => {
      const timeout = getTimeout(true);
      const { args, env } = getClaudeIsolation();
      const output = await safeExec(
        "claude",
        ["-p", "--model", model, "--output-format", "json", ...args],
        buildSmartAuditPrompt(prompt, context),
        timeout,
        env,
      );
      return parseSmartAuditOutput(parseClaudeJson(output));
    },
    runOrchestratedWithClarifications: async (
      prompt,
      clarifications,
      model = "claude-opus-4-5-20251101",
      context = "",
    ) => {
      const timeout = getTimeout(true);
      const { args, env } = getClaudeIsolation();
      const output = await safeExec(
        "claude",
        ["-p", "--model", model, "--output-format", "json", ...args],
        buildSmartClarificationPrompt(prompt, context, clarifications),
        timeout,
        env,
      );
      return parseSmartModeOutput(parseClaudeJson(output));
    },
  },
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
    runStreaming: async (
      prompt,
      callbacks,
      model = "gemini-3-flash-preview",
      context = "",
      persona = "prompt_engineer",
    ) => {
      const timeout = getTimeout(false);
      const { env } = getGeminiIsolation();
      const state = createStreamParserState();

      const output = await safeExecStreaming(
        "gemini",
        ["--model", model, "--output-format", "stream-json"],
        buildOptimizationPrompt(prompt, context, persona),
        timeout,
        env,
        {
          onChunk: (chunk) => {
            const text = parseGeminiStreamChunk(chunk, state);
            if (text) {
              callbacks.onChunk(text);
            }
          },
          abortSignal: callbacks.abortSignal,
        },
      );

      return state.accumulated || output;
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
    runOrchestratedStreaming: async (prompt, callbacks, model = "gemini-3-flash-preview", context = "") => {
      const timeout = getTimeout(true);
      const { env } = getGeminiIsolation();
      const state = createStreamParserState();

      const output = await safeExecStreaming(
        "gemini",
        ["--model", model, "--output-format", "stream-json"],
        buildSmartPrompt(prompt, context),
        timeout,
        env,
        {
          onChunk: (chunk) => {
            const text = parseGeminiStreamChunk(chunk, state);
            if (text) {
              callbacks.onChunk(text);
            }
          },
          abortSignal: callbacks.abortSignal,
        },
      );

      const rawOutput = state.accumulated || output;
      return parseSmartModeOutput(rawOutput);
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
    runStreaming: async (prompt, callbacks, model = "gpt-5.2-codex", context = "", persona = "prompt_engineer") => {
      const timeout = getTimeout(false);
      const { env } = getCodexIsolation();
      const state = createStreamParserState();

      const output = await safeExecStreaming(
        "codex",
        ["exec", "-m", model, "--json", "--config", `model_reasoning_effort="high"`, "--skip-git-repo-check"],
        buildOptimizationPrompt(prompt, context, persona),
        timeout,
        env,
        {
          onChunk: (chunk) => {
            const text = parseCodexStreamChunk(chunk, state);
            if (text) {
              callbacks.onChunk(text);
            }
          },
          abortSignal: callbacks.abortSignal,
        },
      );

      return state.accumulated || output;
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
    runOrchestratedStreaming: async (prompt, callbacks, model = "gpt-5.2-codex", context = "") => {
      const timeout = getTimeout(true);
      const { env } = getCodexIsolation();
      const state = createStreamParserState();

      const output = await safeExecStreaming(
        "codex",
        ["exec", "-m", model, "--json", "--config", `model_reasoning_effort="high"`, "--skip-git-repo-check"],
        buildSmartPrompt(prompt, context),
        timeout,
        env,
        {
          onChunk: (chunk) => {
            const text = parseCodexStreamChunk(chunk, state);
            if (text) {
              callbacks.onChunk(text);
            }
          },
          abortSignal: callbacks.abortSignal,
        },
      );

      const rawOutput = state.accumulated || output;
      return parseSmartModeOutput(rawOutput);
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
