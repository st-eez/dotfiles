import { Icon } from "@raycast/api";
import { safeExec } from "./exec";

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

// Quick mode: Comprehensive single-shot prompt in XML format
function buildQuickPrompt(userPrompt: string): string {
  return `<system>
You are an expert prompt engineer. Transform the user's request into a comprehensive, production-ready prompt.
</system>

<task>
Analyze the user's request, identify the domain and audience, then create a well-structured prompt that will produce high-quality results.
</task>

<rules>
- Output ONLY the optimized prompt using the XML structure shown in output_format
- Do NOT include the output_format wrapper tags - only output the inner tags
- Derive the specific domain from the request (e.g., "senior backend engineer", "UX researcher", "data scientist")
- Include 2-4 bullet points per section, tailored to the specific request
- Be thorough but concise - include all necessary context without padding
- No explanations or meta-commentary
- No code fences
</rules>

<output_format>
<role>You are an expert [derived domain] professional with extensive experience in [specific context]. Your focus is on [key priorities relevant to task].</role>

<objective>[Clear, specific goal statement derived from the request]</objective>

<context>
- Audience: [Who will consume the output]
- Background: [Relevant assumptions or constraints]
</context>

<instructions>
[2-4 numbered steps on HOW to approach the task]
</instructions>

<requirements>
[2-4 bullets on WHAT must be included - content requirements]
</requirements>

<style>
[2-3 bullets on tone, format preferences, design guidelines]
</style>

<output_format>[Expected format: prose, bullets, code, JSON, etc.]</output_format>

<verbosity>[Concise/moderate/detailed - matched to task complexity]</verbosity>

<edge_cases>
[2-3 potential edge cases or error conditions to handle]
</edge_cases>

<success_criteria>
[2-3 measurable criteria for what "done well" looks like]
</success_criteria>

<best_practices>
- Prioritize accuracy over speed - verify claims before stating
- Be explicit about limitations or uncertainties
- [1-2 domain-specific best practices]
</best_practices>
</output_format>

<user_request>
${userPrompt}
</user_request>`;
}

// Detailed mode: Comprehensive phased prompt with checkpoints
function buildDetailedPrompt(userPrompt: string): string {
  return `<system>
You are an expert prompt architect. Create a comprehensive, production-ready prompt with clear phases and approval checkpoints.
</system>

<task>
Analyze the user's request, identify the domain and audience, then create a phased execution prompt. Each phase should have clear deliverables and pause for approval before continuing.
</task>

<rules>
- Output ONLY the optimized prompt using the XML structure shown in output_format
- Do NOT include the output_format wrapper tags - only output the inner tags
- Derive the specific domain from the request (e.g., "senior backend engineer", "UX researcher", "data scientist")
- Break complex work into 2-4 logical phases
- Each phase must have a clear deliverable and checkpoint
- Include 2-4 bullet points per section, tailored to the specific request
- No explanations or meta-commentary
- No code fences
</rules>

<output_format>
<role>You are an expert [derived domain] professional with extensive experience in [specific context]. Your focus is on [key priorities relevant to task].</role>

<objective>[Clear, specific goal statement derived from the request]</objective>

<context>
- Audience: [Who will consume the output]
- Background: [Relevant assumptions or constraints]
- Scope: [What is and isn't included]
</context>

<requirements>
[2-4 bullets on WHAT must be included - content requirements]
</requirements>

<style>
[2-3 bullets on tone, format preferences, design guidelines]
</style>

<output_format>[Expected format: prose, bullets, code, JSON, etc.]</output_format>

<verbosity>[Concise/moderate/detailed - matched to task complexity]</verbosity>

<execution_protocol>
Complete each phase sequentially. Present the deliverable at each checkpoint and wait for explicit approval before proceeding to the next phase.
</execution_protocol>

<phase id="1" name="[Phase Name]">
  <goal>[What this phase accomplishes]</goal>
  <steps>[2-4 numbered actions to take]</steps>
  <deliverable>[Concrete output to present]</deliverable>
  <checkpoint>Present deliverable and await approval before Phase 2.</checkpoint>
</phase>

<phase id="2" name="[Phase Name]">
  <goal>[What this phase accomplishes]</goal>
  <steps>[2-4 numbered actions to take]</steps>
  <deliverable>[Concrete output to present]</deliverable>
  <checkpoint>Present deliverable and await approval.</checkpoint>
</phase>

[Add phase 3-4 if needed for complex tasks]

<edge_cases>
[2-3 potential edge cases or error conditions to handle across phases]
</edge_cases>

<success_criteria>
[2-3 measurable criteria for what "done well" looks like for the complete task]
</success_criteria>

<best_practices>
- Prioritize accuracy over speed - verify claims before stating
- Be explicit about limitations or uncertainties
- Pause at checkpoints even if confident - user approval is required
- [1-2 domain-specific best practices]
</best_practices>
</output_format>

<user_request>
${userPrompt}
</user_request>`;
}

// Dispatcher function
export function buildOptimizationPrompt(userPrompt: string, mode: OptimizationMode = "quick"): string {
  switch (mode) {
    case "quick":
      return buildQuickPrompt(userPrompt);
    case "detailed":
      return buildDetailedPrompt(userPrompt);
    default:
      return buildQuickPrompt(userPrompt);
  }
}

export interface Engine {
  name: string;
  displayName: string;
  icon: Icon;
  defaultModel?: string;
  models?: { id: string; label: string }[];
  run: (prompt: string, model?: string, mode?: OptimizationMode) => Promise<string>;
}

export const engines: Engine[] = [
  {
    name: "codex",
    displayName: "Codex",
    icon: Icon.Code,
    defaultModel: "gpt-5.2-codex",
    models: [{ id: "gpt-5.2-codex", label: "gpt-5.2-codex" }],
    run: async (prompt, model = "gpt-5.2-codex", mode = "quick") => {
      return safeExec(
        "codex",
        ["exec", "-m", model, "--config", `model_reasoning_effort="high"`, "--skip-git-repo-check"],
        buildOptimizationPrompt(prompt, mode),
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
  {
    name: "gemini",
    displayName: "Gemini",
    icon: Icon.Stars,
    defaultModel: "gemini-3-flash-preview",
    models: [
      { id: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
      { id: "gemini-3-pro-preview", label: "Gemini 3 Pro" },
    ],
    run: async (prompt, model = "gemini-3-flash-preview", mode = "quick") => {
      return safeExec("gemini", ["-p", buildOptimizationPrompt(prompt, mode), "--model", model]);
    },
  },
];
