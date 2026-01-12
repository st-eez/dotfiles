export function startProgressTimer(
  toast: { title: string },
  initialMessage: string,
): { stop: () => number; setMessage: (msg: string) => void } {
  let statusMessage = initialMessage;
  const start = Date.now();
  const timer = setInterval(() => {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    toast.title = `${statusMessage}… ${elapsed}s`;
  }, 1000);
  return {
    stop: () => {
      clearInterval(timer);
      return (Date.now() - start) / 1000;
    },
    setMessage: (msg: string) => {
      statusMessage = msg;
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      toast.title = `${statusMessage}… ${elapsed}s`;
    },
  };
}

interface ResultMarkdownOptions {
  optimizedPrompt: string;
  originalPrompt: string;
  additionalContext?: string;
  clarifications?: { question: string; answer: string }[];
  specialistOutputs?: { persona: string; output: string }[];
  getPersonaTitle: (personaId: string) => string;
}

export function buildResultMarkdown(options: ResultMarkdownOptions): string {
  const { optimizedPrompt, originalPrompt, additionalContext, clarifications, specialistOutputs, getPersonaTitle } =
    options;

  let markdown = `# Optimized Prompt\n\n${formatPromptForDisplay(optimizedPrompt)}`;
  markdown += `\n\n---\n\n## Original Prompt\n\n${originalPrompt}`;

  if (additionalContext) {
    markdown += `\n\n---\n\n## Additional Context\n\n${additionalContext}`;
  }

  if (clarifications && clarifications.length > 0) {
    markdown += `\n\n---\n\n## Clarifications\n`;
    markdown += clarifications.map((c) => `- **Q:** ${c.question}\n  **A:** ${c.answer}`).join("\n");
  }

  if (specialistOutputs && specialistOutputs.length > 0) {
    markdown += `\n\n---\n\n## Specialist Perspectives\n\n`;
    markdown += specialistOutputs.map((s) => `### ${getPersonaTitle(s.persona)}\n\n${s.output}`).join("\n\n---\n\n");
  }

  return markdown;
}

export function formatPromptForDisplay(prompt: string): string {
  const tagMappings: Record<string, string> = {
    role: "Role",
    objective: "Objective",
    context: "Context",
    requirements: "Requirements",
    style: "Style Guidelines",
    output_format: "Output Format",
    verbosity: "Verbosity",
    edge_cases: "Edge Cases",
    success_criteria: "Success Criteria",
    best_practices: "Best Practices",
    instructions: "Instructions",
    task: "Task",
    output: "Output Format",
    execution_protocol: "Execution Protocol",
  };

  let formatted = prompt;

  // Strip wrapping markdown code blocks if present
  const codeBlockRegex = /^```(?:markdown|xml|text)?\s*([\s\S]*?)\s*```$/i;
  const match = formatted.match(codeBlockRegex);
  if (match) {
    formatted = match[1].trim();
  }

  // Convert opening tags to headers
  for (const [tag, header] of Object.entries(tagMappings)) {
    const openRegex = new RegExp(`<${tag}>\\s*`, "gi");
    formatted = formatted.replace(openRegex, `\n### ${header}\n`);
  }

  // Remove closing tags
  for (const tag of Object.keys(tagMappings)) {
    const closeRegex = new RegExp(`</${tag}>`, "gi");
    formatted = formatted.replace(closeRegex, "");
  }

  // Handle phase tags specially (supports both id="1" and id="2" etc.)
  formatted = formatted.replace(/<phase\s+id="(\d+)"\s+name="([^"]+)">\s*/gi, "\n### Phase $1: $2\n");
  formatted = formatted.replace(/<\/phase>/gi, "");

  // Convert nested phase elements to bold labels
  const phaseElements = ["goal", "steps", "deliverable", "checkpoint"];
  for (const elem of phaseElements) {
    const openRegex = new RegExp(`<${elem}>`, "gi");
    const closeRegex = new RegExp(`</${elem}>`, "gi");
    formatted = formatted.replace(openRegex, `**${elem.charAt(0).toUpperCase() + elem.slice(1)}:** `);
    formatted = formatted.replace(closeRegex, "\n");
  }

  // Convert any remaining unknown tags to italic labels instead of deleting them
  // This preserves content from unexpected tags the LLM might generate
  formatted = formatted.replace(/<([a-z_]+)>/gi, (_match, tag: string) => {
    const label = tag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return `\n*${label}:* `;
  });
  formatted = formatted.replace(/<\/[a-z_]+>/gi, "\n");

  // Clean up excessive newlines
  formatted = formatted.replace(/\n{3,}/g, "\n\n");

  return formatted.trim();
}
