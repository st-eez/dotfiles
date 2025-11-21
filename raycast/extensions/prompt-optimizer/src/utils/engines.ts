import { safeExec } from "./exec";

function buildOptimizationPrompt(userPrompt: string): string {
    return `You are an expert professional with extensive experience in your field. Rewrite the user's request into a single, ready-to-send prompt.

Goals:
- Make it clear, concise, and complete (length is flexible—optimize for completeness and clarity, not a fixed word count).

Input Requirements:
- Analyze the user's request and extract core objectives.
- Transform casual requests into a professional specification.
- Include necessary details, constraints, and best practices.
- Use short Markdown bullet lists where they improve clarity; otherwise prefer sentences.

Step-by-Step Guidance:
1. Identify the user's goal and audience.
2. Add required sections (context, deliverables, constraints, edge cases, success criteria).
3. State quality expectations (clarity, completeness, avoidance of hallucinations).
4. Keep tone direct and professional.

Output Rules:
- Return ONLY the optimized prompt text in Markdown.
- Derive the domain and inject it plus a brief domain-specific context into the opening line. First line MUST begin with: "You are an expert [domain] professional with extensive experience in [specific domain context]."
- Use these section headings (exactly): "## Role and Objective", "## Instructions", "## Content Requirements", "## Design/Style Guidelines", "## Output Format", "## Output Verbosity", "## Edge Cases", "## Success Criteria", "## Best Practices".
- Each section should have 2–6 concise bullets tuned to the user request (include audience in Role/Context; Best Practices can cover clarity, accessibility, avoiding hallucinations).
- Keep length as long as needed for completeness while remaining concise (no fixed word limit).
- Do NOT include any extra title like "Optimized Prompt".
- Do NOT wrap in code fences.
- No meta commentary—only the optimized prompt content.

User Request: ${userPrompt}`;
}

export interface Engine {
    name: string;
    displayName: string;
    defaultModel?: string;
    models?: { id: string; label: string }[];
    run: (prompt: string, model?: string) => Promise<string>;
}

export const engines: Engine[] = [
    {
        name: "codex",
        displayName: "Codex",
        defaultModel: "gpt-5.1-codex-max",
        models: [
            { id: "gpt-5.1-codex-max", label: "gpt-5.1-codex-max" },
            { id: "gpt-5.1-codex", label: "gpt-5.1-codex" },
            { id: "gpt-5.1-codex-mini", label: "gpt-5.1-codex-mini" },
            { id: "gpt-5.1", label: "gpt-5.1" },
        ],
        run: async (prompt, model = "gpt-5.1-codex-max") => {
            // Codex: codex exec -m <model> --config model_reasoning_effort="<level>" "<prompt>"
            return safeExec("codex", [
                "exec",
                "-m",
                model,
                "--config",
                `model_reasoning_effort="medium"`,
                "--skip-git-repo-check",
                buildOptimizationPrompt(prompt),
            ]);
        },
    },
    {
        name: "claude",
        displayName: "Claude",
        defaultModel: "sonnet",
        models: [
            { id: "sonnet", label: "Sonnet" },
            { id: "haiku", label: "Haiku" },
            { id: "opus", label: "Opus" },
        ],
        run: async (prompt, model = "sonnet") => {
            // Claude: claude -p "<prompt>" --model sonnet (alias for latest Sonnet)
            return safeExec("claude", ["-p", buildOptimizationPrompt(prompt), "--model", model]);
        },
    },
    {
        name: "gemini",
        displayName: "Gemini",
        defaultModel: "gemini-2.5-pro",
        models: [
            { id: "gemini-2.5-pro", label: "gemini-2.5-pro" },
            { id: "gemini-2.5-flash", label: "gemini-2.5-flash" },
            { id: "gemini-2.5-flash-lite", label: "gemini-2.5-flash-lite" },
        ],
        run: async (prompt, model = "gemini-2.5-pro") => {
            // Gemini: gemini -p "<prompt>" --model <model>
            return safeExec("gemini", ["-p", buildOptimizationPrompt(prompt), "--model", model]);
        },
    },
    {
        name: "opencode",
        displayName: "Opencode",
        run: async (prompt) => {
            // Opencode: opencode -p "<prompt>" -m grok-code-fast-1
            return safeExec("opencode", ["-p", buildOptimizationPrompt(prompt), "-m", "grok-code-fast-1"]);
        },
    },
];
