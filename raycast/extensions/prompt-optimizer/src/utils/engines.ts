import { Icon } from "@raycast/api";
import { safeExec, getTimeout, parseGeminiJson } from "./exec";
// Current production strategy - update this import when promoting a new A/B test winner
import { buildQuickPrompt, buildDetailedPrompt } from "../prompts/v1-baseline";
import { PERSONA_INSTRUCTIONS } from "../prompts/personas";

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
  runOrchestrated?: (prompt: string, model?: string, mode?: OptimizationMode, context?: string) => Promise<string>;
  runWithClarifications: (
    prompt: string,
    clarifications: { question: string; answer: string }[],
    model?: string,
    mode?: OptimizationMode,
    context?: string,
    personaId?: string,
  ) => Promise<string>;
}

/* 
  ORCHESTRATOR LOGIC 
  - classifyIntent: Determine which personas are needed
  - synthesizeResults: Merge multiple specialist outputs
*/

interface IntentClassification {
  personas: string[];
  confidence: number;
  reasoning?: string;
}

const CLASSIFICATION_PROMPT = (prompt: string, context: string) => `<system>
You are an intent classifier for a prompt optimization tool.
Analyze the user's request and determine which expert perspectives would produce the best optimized prompt.
</system>

<rules>
- Return ONLY valid JSON, no markdown
- Select 1-3 personas maximum
- Higher confidence = clearer intent
</rules>

<personas>
- prompt_engineer: Clarity, structure, actionability
- software_engineer: Code quality, patterns, edge cases
- architect: Design, scalability, tradeoffs
- devops: Deployment, infrastructure, reliability
- security_auditor: Vulnerabilities, auth, validation
- product_manager: User value, requirements
- data_scientist: Statistics, data integrity
- content_writer: Tone, engagement, audience
- researcher: Investigation, unbalanced analysis, evidence
</personas>

<output_format>
{"personas": ["id1", "id2"], "confidence": 0.9}
</output_format>

<user_request>
${prompt}
</user_request>

<additional_context>
${context}
</additional_context>`;

const SYNTHESIS_PROMPT = (originalPrompt: string, results: { persona: string; output: string }[]) => `<system>
You are an expert synthesizer. Merge multiple specialized prompt perspectives into one cohesive, superior optimized prompt.
</system>

<rules>
- Preserve the BEST elements from each perspective
- Resolve conflicts by choosing the more specific/useful option
- Output a single unified prompt using standard XML format
- Do NOT list perspectives separately—merge them
</rules>

<perspectives>
${results.map((r) => `<${r.persona}>\n${r.output}\n</${r.persona}>`).join("\n")}
</perspectives>

<original_request>
${originalPrompt}
</original_request>`;

export async function classifyIntent(prompt: string, context: string): Promise<IntentClassification> {
  // Use a fast model for classification (defaults to Gemini Flash)
  // We use safeExec directly here to avoid circular dependency or engine lookup complexity
  // Ideally, valid engines are passed in, but for now we default to 'gemini' for the orchestrator brain
  try {
    const output = await safeExec(
      "gemini",
      [
        "--allowed-mcp-server-names",
        "none",
        "-e",
        "none",
        "--model",
        "gemini-3-flash-preview",
        "--output-format",
        "json",
      ],
      CLASSIFICATION_PROMPT(prompt, context), // stdin piping for large prompts
    );
    const response = parseGeminiJson(output);
    return JSON.parse(response.trim());
  } catch (error) {
    console.error("Classification failed:", error);
    // Fallback: just use prompt_engineer
    return { personas: ["prompt_engineer"], confidence: 0 };
  }
}

export async function synthesizeResults(
  originalPrompt: string,
  results: { persona: string; output: string }[],
): Promise<string> {
  try {
    const output = await safeExec(
      "gemini",
      [
        "--allowed-mcp-server-names",
        "none",
        "-e",
        "none",
        "--model",
        "gemini-3-flash-preview",
        "--output-format",
        "json",
      ],
      SYNTHESIS_PROMPT(originalPrompt, results), // stdin piping for large prompts
    );
    return parseGeminiJson(output).trim();
  } catch (error) {
    console.error("Synthesis failed:", error);
    return results[0]?.output || "Synthesis failed";
  }
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
      // --allowed-mcp-server-names none -e none: Disable MCP servers and extensions for faster non-interactive execution
      const timeout = getTimeout(mode, false);
      const output = await safeExec(
        "gemini",
        ["--allowed-mcp-server-names", "none", "-e", "none", "--model", model, "--output-format", "json"],
        buildOptimizationPrompt(prompt, mode, context, persona), // stdin piping for large prompts
        timeout,
      );
      return parseGeminiJson(output);
    },
    audit: async (prompt, model = "gemini-3-flash-preview", context = "", persona = "prompt_engineer") => {
      const output = await safeExec(
        "gemini",
        ["--allowed-mcp-server-names", "none", "-e", "none", "--model", model, "--output-format", "json"],
        buildAuditPrompt(prompt, context, persona), // stdin piping for large prompts
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
      mode = "quick",
      context = "",
      persona = "prompt_engineer",
    ) => {
      const output = await safeExec(
        "gemini",
        ["--allowed-mcp-server-names", "none", "-e", "none", "--model", model, "--output-format", "json"],
        buildClarificationPrompt(prompt, mode, context, persona, clarifications), // stdin piping
      );
      return parseGeminiJson(output);
    },
    runOrchestrated: async (prompt, model = "gemini-3-flash-preview", mode = "quick", context = "") => {
      // 1. Classify
      const classification = await classifyIntent(prompt, context);
      const personasToRun = classification.personas.length > 0 ? classification.personas : ["prompt_engineer"];

      // 2. Parallel Execution
      const timeout = getTimeout(mode, true);
      const results = await Promise.all(
        personasToRun.map(async (p) => {
          const rawOutput = await safeExec(
            "gemini",
            ["--allowed-mcp-server-names", "none", "-e", "none", "--model", model, "--output-format", "json"],
            buildOptimizationPrompt(prompt, mode, context, p), // stdin piping
            timeout,
          );
          return { persona: p, output: parseGeminiJson(rawOutput) };
        }),
      );

      // 3. Synthesize
      if (results.length > 1) {
        return synthesizeResults(prompt, results);
      } else {
        return results[0].output;
      }
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
      return safeExec(
        "codex",
        ["exec", "-m", model, "--config", `model_reasoning_effort="high"`, "--skip-git-repo-check"],
        buildOptimizationPrompt(prompt, mode, context, persona),
        timeout,
      );
    },
    audit: async (prompt, model = "gpt-5.2-codex", context = "", persona = "prompt_engineer") => {
      const result = await safeExec(
        "codex",
        ["exec", "-m", model, "--config", `model_reasoning_effort="high"`, "--skip-git-repo-check"],
        buildAuditPrompt(prompt, context, persona),
      );
      try {
        // Clean up markdown fences if present
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
      mode = "quick",
      context = "",
      persona = "prompt_engineer",
    ) => {
      return safeExec(
        "codex",
        ["exec", "-m", model, "--config", `model_reasoning_effort="high"`, "--skip-git-repo-check"],
        buildClarificationPrompt(prompt, mode, context, persona, clarifications),
      );
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
