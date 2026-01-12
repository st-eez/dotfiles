import { Action, ActionPanel, Detail, Form, Icon, showToast, Toast, useNavigation, Color } from "@raycast/api";
import { useState, Fragment } from "react";
import { ClarificationQuestion, engines, getPersonaTitle, getPersonaIcon } from "./utils/engines";
import { startProgressTimer, buildResultMarkdown } from "./utils/format";
import { addToHistory } from "./utils/history";

interface ResolveAmbiguityProps {
  questions: ClarificationQuestion[];
  draftPrompt: string;
  context: string;
  persona: string;
  engineName: string;
  model: string;
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

    const progress = startProgressTimer(toast, statusMessage);

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

      if (smartMode && engine.runOrchestratedWithClarifications) {
        const smartResult = await engine.runOrchestratedWithClarifications(draftPrompt, clarifications, model, context);
        optimizedPrompt = smartResult.synthesis;
        results = smartResult.perspectives;
        personasUsed = smartResult.personasUsed;
      } else {
        optimizedPrompt = await engine.runWithClarifications(draftPrompt, clarifications, model, context, persona);
      }

      const totalSec = progress.stop().toFixed(1);

      toast.style = Toast.Style.Success;
      toast.title = "Prompt optimized!";

      await addToHistory({
        originalPrompt: draftPrompt,
        optimizedPrompt,
        additionalContext: context || undefined,
        engine: engine.displayName,
        model,
        persona: smartMode ? "Orchestrator" : persona,
        durationSec: totalSec,
        specialistOutputs: smartMode && results.length > 0 ? results : undefined,
      });

      push(
        <Detail
          markdown={buildResultMarkdown({
            optimizedPrompt,
            originalPrompt: draftPrompt,
            additionalContext: context || undefined,
            clarifications,
            specialistOutputs: smartMode && results.length > 0 ? results : undefined,
            getPersonaTitle,
          })}
          metadata={
            <Detail.Metadata>
              <Detail.Metadata.Label title="Engine" text={engine.displayName} icon={engine.icon} />
              <Detail.Metadata.Label title="Model" text={model} />
              <Detail.Metadata.Label
                title="Persona"
                text={smartMode ? "Smart Orchestrator" : getPersonaTitle(persona)}
                icon={smartMode ? Icon.Stars : getPersonaIcon(persona)}
              />
              {smartMode && personasUsed.length > 0 && (
                <Detail.Metadata.TagList title="Active Specialists">
                  {personasUsed.map((specialistId) => (
                    <Detail.Metadata.TagList.Item
                      key={specialistId}
                      text={getPersonaTitle(specialistId)}
                      icon={getPersonaIcon(specialistId)}
                      color={Color.Magenta}
                    />
                  ))}
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
      progress.stop();
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
