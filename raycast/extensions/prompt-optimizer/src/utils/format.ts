// Format XML-style prompt output to readable markdown
export function formatPromptForDisplay(prompt: string): string {
  // Map XML tags to markdown headers (comprehensive list for both modes)
  const tagMappings: Record<string, string> = {
    // Common tags
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
    // Quick mode specific
    instructions: "Instructions",
    task: "Task",
    output: "Output Format",
    // Detailed mode specific
    execution_protocol: "Execution Protocol",
  };

  let formatted = prompt;

  // Convert opening tags to headers
  for (const [tag, header] of Object.entries(tagMappings)) {
    const openRegex = new RegExp(`<${tag}>`, "gi");
    formatted = formatted.replace(openRegex, `\n### ${header}\n`);
  }

  // Remove closing tags
  for (const tag of Object.keys(tagMappings)) {
    const closeRegex = new RegExp(`</${tag}>`, "gi");
    formatted = formatted.replace(closeRegex, "");
  }

  // Handle phase tags specially (supports both id="1" and id="2" etc.)
  formatted = formatted.replace(/<phase\s+id="(\d+)"\s+name="([^"]+)">/gi, "\n### Phase $1: $2\n");
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
