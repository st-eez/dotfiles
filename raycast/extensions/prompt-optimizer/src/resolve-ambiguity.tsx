import { Action, ActionPanel, Detail, Form, Icon, showToast, Toast, useNavigation, Color } from "@raycast/api";
import { useState, Fragment } from "react";
import { ClarificationQuestion, engines, OptimizationMode, OPTIMIZATION_MODES, PERSONAS } from "./utils/engines";
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
  smartMode: boolean;
  auditPersonas: string[];
}

export default function ResolveAmbiguity({
  questions,
  draftPrompt,
  context,
  persona,
  engineName,
  model,
  mode,
  smartMode,
  auditPersonas,
}: ResolveAmbiguityProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { push, pop } = useNavigation();

  async function handleSubmit() {
    setIsLoading(true);
    const statusMessage = smartMode ? "Smart synthesis" : "Synthesizing";
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `${statusMessage}...`,
    });

    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      toast.title = `${statusMessage}… ${elapsed}s`;
    }, 1000);

    try {
      const engine = engines.find((e) => e.name === engineName);
      if (!engine) throw new Error("Engine not found");

      const clarifications = questions.map((q) => ({
        question: q.question,
        answer: answers[q.id] || "No specific preference",
      }));

      let optimizedPrompt = "";
      let results: { persona: string; output: string }[] = [];
      let personasUsed: string[] = auditPersonas;

      // Route based on smartMode
      if (smartMode && engine.runOrchestratedWithClarifications) {
        const smartResult = await engine.runOrchestratedWithClarifications(
          draftPrompt,
          clarifications,
          model,
          mode,
          context,
        );
        optimizedPrompt = smartResult.synthesis;
        results = smartResult.perspectives;
        personasUsed = smartResult.personasUsed;
      } else {
        // Single-persona synthesis
        optimizedPrompt = await engine.runWithClarifications(
          draftPrompt,
          clarifications,
          model,
          mode,
          context,
          persona,
        );
      }

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
        persona: smartMode ? "Orchestrator" : persona,
        durationSec: totalSec,
        specialistOutputs: smartMode && results.length > 0 ? results : undefined,
      });

      const modeLabel = OPTIMIZATION_MODES.find((m) => m.id === mode)?.label ?? mode;
      const modeColor = mode === "detailed" ? Color.Blue : Color.Green;

      push(
        <Detail
          markdown={`# Optimized Prompt\n\n${formatPromptForDisplay(optimizedPrompt)}\n\n---\n\n## Original Prompt\n\n${draftPrompt}${context ? `\n\n---\n\n## Additional Context\n\n${context}` : ""}\n\n---\n\n## Clarifications\n${clarifications.map((c) => `- **Q:** ${c.question}\n  **A:** ${c.answer}`).join("\n")}${smartMode && results.length > 0 ? `\n\n---\n\n## Specialist Perspectives\n\n${results.map((s) => `### ${PERSONAS.find((p) => p.id === s.persona)?.title || s.persona}\n\n${s.output}`).join("\n\n---\n\n")}` : ""}`}
          metadata={
            <Detail.Metadata>
              <Detail.Metadata.TagList title="Mode">
                <Detail.Metadata.TagList.Item text={modeLabel} color={modeColor} />
              </Detail.Metadata.TagList>
              <Detail.Metadata.Separator />
              <Detail.Metadata.Label title="Engine" text={engine.displayName} icon={engine.icon} />
              <Detail.Metadata.Label title="Model" text={model} />
              <Detail.Metadata.Label
                title="Persona"
                text={smartMode ? "Smart Orchestrator" : (PERSONAS.find((p) => p.id === persona)?.title ?? persona)}
                icon={smartMode ? Icon.Stars : PERSONAS.find((p) => p.id === persona)?.icon}
              />
              {smartMode && personasUsed.length > 0 && (
                <Detail.Metadata.TagList title="Active Specialists">
                  {personasUsed.map((specialistId) => {
                    const p = PERSONAS.find((pers) => pers.id === specialistId);
                    return (
                      <Detail.Metadata.TagList.Item
                        key={specialistId}
                        text={p?.title || specialistId}
                        icon={p?.icon}
                        color={Color.Magenta}
                      />
                    );
                  })}
                </Detail.Metadata.TagList>
              )}
              <Detail.Metadata.Separator />
              <Detail.Metadata.Label title="Duration" text={`${totalSec}s`} icon={Icon.Clock} />
              <Detail.Metadata.Label title="Original Input" text={draftPrompt} />
              <Detail.Metadata.Label title="Original Length" text={`${draftPrompt.length} chars`} />
              <Detail.Metadata.Label title="Optimized Length" text={`${optimizedPrompt.length} chars`} />
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
      clearInterval(timer);
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
          <Action.CopyToClipboard
            title="Copy Questions"
            content={questions.map((q, i) => `${i + 1}. ${q.question}`).join("\n")}
            shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
          />
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
