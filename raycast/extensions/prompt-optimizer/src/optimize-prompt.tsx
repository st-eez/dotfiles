import {
  Action,
  ActionPanel,
  Color,
  Form,
  showToast,
  Toast,
  useNavigation,
  Detail,
  Icon,
  getSelectedText,
} from "@raycast/api";
import { useEffect, useState } from "react";
import {
  engines,
  PERSONAS,
  getPersonaTitle,
  getPersonaIcon,
  type SmartModeResult,
  type StreamingCallbacks,
} from "./utils/engines";
import { StreamingDetail, type StreamingConfig } from "./components/StreamingDetail";
import { startProgressTimer, buildResultMarkdown } from "./utils/format";
import { addToHistory } from "./utils/history";
import { useDebounce } from "./hooks/useDebounce";
import { config } from "./config";
import HistoryCommand from "./history";
import Templates from "./templates";
import SaveTemplate from "./save-template";
import ResolveAmbiguity from "./resolve-ambiguity";
import { applyTemplate } from "./utils/templates";

export default function Command() {
  const [prompt, setPrompt] = useState("");
  const [selectedEngine, setSelectedEngine] = useState(engines[0].name);
  const [selectedModel, setSelectedModel] = useState(() => getDefaultModel(engines[0]));
  const [additionalContext, setAdditionalContext] = useState("");
  const [selectedPersona, setSelectedPersona] = useState("prompt_engineer");
  const [smartMode, setSmartMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { push, pop } = useNavigation();

  async function handleGrabContext() {
    try {
      const text = await getSelectedText();
      if (text) {
        setAdditionalContext((prev) => (prev ? prev + "\n\n" + text : text));
        showToast({ style: Toast.Style.Success, title: "Context added" });
      }
    } catch {
      showToast({ style: Toast.Style.Failure, title: "No text selected" });
    }
  }

  const currentEngine = engines.find((e) => e.name === selectedEngine);

  useEffect(() => {
    if (currentEngine) {
      setSelectedModel(getDefaultModel(currentEngine));
    }
  }, [selectedEngine, currentEngine]);

  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const debouncedPrompt = useDebounce(prompt, config.templateVariableDebounceMs);

  useEffect(() => {
    const matches = debouncedPrompt.match(/\{\{([^}]+)\}\}/g);
    if (matches) {
      const uniqueVars = Array.from(new Set(matches.map((m) => m.slice(2, -2).trim())));
      setTemplateVariables(uniqueVars);

      setVariableValues((prev) => {
        const next: Record<string, string> = {};
        uniqueVars.forEach((v) => {
          next[v] = prev[v] || "";
        });
        return next;
      });
    } else {
      setTemplateVariables([]);
      setVariableValues({});
    }
  }, [debouncedPrompt]);

  function handleInsertVariable() {
    setPrompt((prev) => prev + "{{}}");
    // We can't easily move cursor inside brackets in Raycast Form, so user has to type it.
  }

  function handleEngineChange(engineName: string) {
    setSelectedEngine(engineName);
    const engine = engines.find((e) => e.name === engineName);
    setSelectedModel(getDefaultModel(engine));
  }

  // Template Actions
  function handleLoadTemplate() {
    push(
      <Templates
        onSelect={(template) => {
          setPrompt(template.content);
          showToast({ style: Toast.Style.Success, title: "Template loaded" });
        }}
      />,
    );
  }

  function handleSaveTemplate() {
    if (!prompt.trim()) {
      showToast({ style: Toast.Style.Failure, title: "Cannot save empty template" });
      return;
    }
    push(<SaveTemplate content={prompt} />);
  }

  async function handleSubmit() {
    if (!prompt.trim()) {
      showToast({
        style: Toast.Style.Failure,
        title: "Prompt cannot be empty",
      });
      return;
    }

    const engine = currentEngine;
    if (!engine) {
      showToast({ style: Toast.Style.Failure, title: "Selected engine not found" });
      return;
    }

    const modelToUse = engine.models?.length
      ? (ensureValidModel(selectedModel, engine) ?? getDefaultModel(engine))
      : undefined;
    const finalPrompt = applyTemplate(prompt, variableValues);

    const canStreamSmart = smartMode && engine.runOrchestratedStreaming;
    const canStreamNormal = !smartMode && engine.runStreaming;

    if (canStreamSmart || canStreamNormal) {
      handleStreamingSubmit(engine, finalPrompt, modelToUse);
      return;
    }

    setIsLoading(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Optimizing prompt...",
    });

    const progress = startProgressTimer(toast, "Optimizing prompt");

    try {
      let optimizedPrompt = "";
      let results: { persona: string; output: string }[] = [];
      let personasToRun: string[] = [];

      if (smartMode) {
        if (!engine.runOrchestrated) {
          throw new Error("Smart mode requires an engine with runOrchestrated support");
        }
        progress.setMessage("Smart mode optimization");

        const smartResult: SmartModeResult = await engine.runOrchestrated(
          finalPrompt,
          modelToUse,
          additionalContext || "",
        );
        optimizedPrompt = smartResult.synthesis;
        results = smartResult.perspectives;
        personasToRun = smartResult.personasUsed;
      } else {
        optimizedPrompt = await engine.run(finalPrompt, modelToUse, additionalContext, selectedPersona);
      }

      const totalSec = progress.stop().toFixed(1);
      toast.style = Toast.Style.Success;
      toast.title = `Prompt optimized in ${totalSec}s`;

      await addToHistory({
        originalPrompt: prompt,
        optimizedPrompt,
        additionalContext: additionalContext || undefined,
        engine: engine.displayName,
        model: modelToUse,
        persona: smartMode ? "Orchestrator" : selectedPersona,
        durationSec: totalSec,
        specialistOutputs: smartMode && results.length > 0 ? results : undefined,
      });

      push(
        <Detail
          markdown={buildResultMarkdown({
            optimizedPrompt,
            originalPrompt: prompt,
            additionalContext: additionalContext || undefined,
            specialistOutputs: smartMode && results.length > 0 ? results : undefined,
            getPersonaTitle,
          })}
          metadata={
            <Detail.Metadata>
              <Detail.Metadata.Label title="Engine" text={engine.displayName} icon={engine.icon} />
              {modelToUse && <Detail.Metadata.Label title="Model" text={modelToUse} />}
              <Detail.Metadata.Label
                title="Persona"
                text={smartMode ? "Smart Orchestrator" : getPersonaTitle(selectedPersona)}
                icon={smartMode ? Icon.Stars : getPersonaIcon(selectedPersona)}
              />
              {smartMode && personasToRun.length > 0 && (
                <Detail.Metadata.TagList title="Active Specialists">
                  {personasToRun.map((specialistId) => (
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
              <Detail.Metadata.Label title="Original Input" text={prompt} />
              <Detail.Metadata.Label title="Original Length" text={`${prompt.length} chars`} />
              <Detail.Metadata.Label title="Optimized Length" text={`${optimizedPrompt.length} chars`} />
            </Detail.Metadata>
          }
          actions={
            <ActionPanel>
              <Action.CopyToClipboard content={optimizedPrompt} />
              <Action.CopyToClipboard
                title="Copy Original Prompt"
                content={prompt}
                shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
              />
            </ActionPanel>
          }
        />,
      );
    } catch (error: unknown) {
      progress.stop();
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to optimize prompt";
      toast.message = error instanceof Error ? error.message : String(error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleStreamingSubmit(
    engine: (typeof engines)[number],
    finalPrompt: string,
    modelToUse: string | undefined,
  ) {
    const config: StreamingConfig = {
      originalPrompt: prompt,
      additionalContext: additionalContext || undefined,
      engineName: engine.displayName,
      model: modelToUse,
      persona: selectedPersona,
      smartMode,
      doStream: (callbacks: StreamingCallbacks) =>
        engine.runStreaming
          ? engine.runStreaming(finalPrompt, callbacks, modelToUse, additionalContext, selectedPersona)
          : Promise.reject(new Error("Streaming not supported")),
      doStreamSmart: engine.runOrchestratedStreaming
        ? (callbacks: StreamingCallbacks) =>
            engine.runOrchestratedStreaming!(finalPrompt, callbacks, modelToUse, additionalContext)
        : undefined,
    };

    push(<StreamingDetail config={config} />);
  }

  async function handleCriticSubmit() {
    if (!prompt.trim()) {
      showToast({ style: Toast.Style.Failure, title: "Prompt cannot be empty" });
      return;
    }

    const engine = currentEngine;
    if (!engine) return;

    setIsLoading(true);
    const statusMessage = smartMode ? "Smart audit" : "Auditing";
    const toast = await showToast({ style: Toast.Style.Animated, title: `${statusMessage}...` });

    const progress = startProgressTimer(toast, statusMessage);

    try {
      const finalPrompt = applyTemplate(prompt, variableValues);
      const modelToUse = engine.models?.length
        ? (ensureValidModel(selectedModel, engine) ?? getDefaultModel(engine))
        : undefined;

      let questions: { id: string; question: string }[] = [];
      let auditPersonas: string[] = [];

      // Route based on smartMode
      if (smartMode && engine.auditOrchestrated) {
        const auditResult = await engine.auditOrchestrated(finalPrompt, modelToUse, additionalContext);
        questions = auditResult.questions;
        auditPersonas = auditResult.personasUsed;
      } else {
        // Single-persona audit
        const singlePersonaQuestions = await engine.audit(finalPrompt, modelToUse, additionalContext, selectedPersona);
        questions = singlePersonaQuestions;
      }

      progress.stop();

      if (questions.length === 0) {
        toast.title = "No ambiguity found. Optimizing...";
        await handleSubmit(); // Fallback to standard flow (respects smartMode)
        return;
      }

      // Pass 2: Wizard
      toast.title = "Ambiguity detected";
      toast.style = Toast.Style.Success;

      push(
        <ResolveAmbiguity
          questions={questions}
          draftPrompt={finalPrompt}
          context={additionalContext}
          persona={selectedPersona}
          engineName={engine.name}
          model={modelToUse || engine.defaultModel || ""}
          smartMode={smartMode}
          auditPersonas={auditPersonas}
        />,
      );
    } catch (error) {
      progress.stop();
      toast.style = Toast.Style.Failure;
      toast.title = "Audit failed";
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      navigationTitle="Prompt Optimizer"
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Optimize Prompt" onSubmit={handleSubmit} />
          <Action.SubmitForm
            title="Optimize with Critic"
            icon={Icon.Eye}
            shortcut={{ modifiers: ["cmd", "shift"], key: "return" }}
            onSubmit={handleCriticSubmit}
          />
          <Action title="New Optimization" onAction={pop} />
          <Action.Push title="View History" target={<HistoryCommand />} shortcut={{ modifiers: ["cmd"], key: "h" }} />
          <Action
            title="Grab Context"
            icon={Icon.TextDocument}
            shortcut={{ modifiers: ["cmd", "shift"], key: "g" }}
            onAction={handleGrabContext}
          />
          <Action
            title="Insert Variable"
            icon={Icon.PlusCircle}
            shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
            onAction={handleInsertVariable}
          />
          <ActionPanel.Section>
            <Action
              title="Save as Template"
              icon={Icon.SaveDocument}
              shortcut={{ modifiers: ["cmd"], key: "t" }}
              onAction={handleSaveTemplate}
            />
            <Action
              title="Load Template"
              icon={Icon.Document}
              shortcut={{ modifiers: ["cmd"], key: "l" }}
              onAction={handleLoadTemplate}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="prompt"
        title="Prompt"
        placeholder="Enter your prompt here..."
        value={prompt}
        onChange={setPrompt}
      />

      {templateVariables.length > 0 && (
        <>
          <Form.Description text="Variables Detected" />
          {templateVariables.map((variable) => (
            <Form.TextField
              key={variable}
              id={`var_${variable}`}
              title={variable}
              placeholder={`Value for ${variable}`}
              value={variableValues[variable] || ""}
              onChange={(newValue) => setVariableValues((prev) => ({ ...prev, [variable]: newValue }))}
            />
          ))}
          <Form.Separator />
        </>
      )}

      <Form.TextArea
        id="context"
        title="Additional Context"
        placeholder="Paste relevant background info, existing code, or chat logs..."
        value={additionalContext}
        onChange={setAdditionalContext}
        info="Press ⌘⇧G to grab selected text from the active app."
      />

      <Form.Separator />

      <Form.Dropdown
        id="persona"
        title="Persona"
        value={selectedPersona}
        onChange={setSelectedPersona}
        info="Select a persona to tailor the optimization style."
      >
        {PERSONAS.map((p) => (
          <Form.Dropdown.Item key={p.id} value={p.id} title={p.title} icon={p.icon} />
        ))}
      </Form.Dropdown>

      <Form.Checkbox
        id="smartMode"
        label="Smart Persona Detection"
        value={smartMode}
        onChange={setSmartMode}
        info="Auto-detect and combine relevant expert perspectives"
      />

      <Form.Separator />
      <Form.Dropdown
        id="engine"
        title="Engine"
        value={selectedEngine}
        onChange={handleEngineChange}
        info="Different AI engines may produce varying optimization styles."
      >
        {engines.map((engine) => (
          <Form.Dropdown.Item key={engine.name} value={engine.name} title={engine.displayName} icon={engine.icon} />
        ))}
      </Form.Dropdown>
      {currentEngine?.models?.length ? (
        <Form.Dropdown
          id="model"
          title="Model"
          value={ensureValidModel(selectedModel, currentEngine)}
          onChange={setSelectedModel}
        >
          {currentEngine.models.map((model) => (
            <Form.Dropdown.Item key={model.id} value={model.id} title={model.label} />
          ))}
        </Form.Dropdown>
      ) : null}
      <Form.Description text="⌘H for history • ⌘⇧↵ for critic" />
    </Form>
  );
}

function getDefaultModel(engine: (typeof engines)[number] | undefined): string {
  if (!engine?.models || engine.models.length === 0) {
    return "";
  }
  return engine.defaultModel ?? engine.models[0].id;
}

function ensureValidModel(selected: string, engine: (typeof engines)[number] | undefined): string {
  if (!engine?.models || engine.models.length === 0) return "";
  const isValid = engine.models.some((m) => m.id === selected);
  return isValid ? selected : getDefaultModel(engine);
}
