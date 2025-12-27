import { Action, ActionPanel, Detail, Form, Icon, showToast, Toast, useNavigation, Color } from "@raycast/api";
import { useState, Fragment } from "react";
import { ClarificationQuestion, engines, OptimizationMode, OPTIMIZATION_MODES } from "./utils/engines";
import { formatPromptForDisplay } from "./utils/format";
import { addToHistory } from "./utils/history";

interface ResolveAmbiguityProps {
  questions: ClarificationQuestion[];
  draftPrompt: string;
  context: string;
  persona: string;
  engineName: string;
  model: string;
  mode: OptimizationMode;
}

export default function ResolveAmbiguity({
  questions,
  draftPrompt,
  context,
  persona,
  engineName,
  model,
  mode,
}: ResolveAmbiguityProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { push, pop } = useNavigation();

  async function handleSubmit() {
    setIsLoading(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Synthesizing final prompt...",
    });

    try {
      const engine = engines.find((e) => e.name === engineName);
      if (!engine) throw new Error("Engine not found");

      const clarifications = questions.map((q) => ({
        question: q.question,
        answer: answers[q.id] || "No specific preference",
      }));

      const start = Date.now();
      const optimizedPrompt = await engine.runWithClarifications(
        draftPrompt,
        clarifications,
        model,
        mode,
        context,
        persona,
      );
      const totalSec = ((Date.now() - start) / 1000).toFixed(1);

      toast.style = Toast.Style.Success;
      toast.title = "Prompt optimized!";

      await addToHistory({
        originalPrompt: draftPrompt,
        optimizedPrompt,
        additionalContext: context || undefined,
        engine: engine.displayName,
        model,
        mode,
        persona,
        durationSec: totalSec,
      });

      const modeLabel = OPTIMIZATION_MODES.find((m) => m.id === mode)?.label ?? mode;
      const modeColor = mode === "detailed" ? Color.Blue : Color.Green;

      push(
        <Detail
          markdown={`# Optimized Prompt\n\n${formatPromptForDisplay(optimizedPrompt)}\n\n---\n\n## Original Prompt\n\n${draftPrompt}${context ? `\n\n---\n\n## Additional Context\n\n${context}` : ""}\n\n---\n\n## Clarifications\n${clarifications.map((c) => `- **Q:** ${c.question}\n  **A:** ${c.answer}`).join("\n")}`}
          metadata={
            <Detail.Metadata>
              <Detail.Metadata.TagList title="Mode">
                <Detail.Metadata.TagList.Item text={modeLabel} color={modeColor} />
              </Detail.Metadata.TagList>
              <Detail.Metadata.Separator />
              <Detail.Metadata.Label title="Engine" text={engine.displayName} icon={engine.icon} />
              <Detail.Metadata.Label title="Model" text={model} />
              <Detail.Metadata.Separator />
              <Detail.Metadata.Label title="Duration" text={`${totalSec}s`} icon={Icon.Clock} />
            </Detail.Metadata>
          }
          actions={
            <ActionPanel>
              <Action.CopyToClipboard content={optimizedPrompt} />
              <Action title="New Optimization" onAction={pop} />
            </ActionPanel>
          }
        />,
      );
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to optimize";
      toast.message = String(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      navigationTitle="Resolve Ambiguity"
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Finish Optimization" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text={`The ${engineName} engine needs clarification to generate the best prompt.`} />

      {questions.map((q, i) => (
        <Fragment key={q.id}>
          <Form.Separator />
          <Form.Description title={`Question ${i + 1}`} text={q.question} />
          <Form.TextField
            id={q.id}
            placeholder="Your answer..."
            value={answers[q.id] || ""}
            onChange={(val) => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
          />
        </Fragment>
      ))}
    </Form>
  );
}
