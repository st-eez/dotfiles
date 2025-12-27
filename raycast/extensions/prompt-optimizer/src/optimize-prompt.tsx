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
  OPTIMIZATION_MODES,
  PERSONAS,
  classifyIntent,
  synthesizeResults,
  type OptimizationMode,
} from "./utils/engines";
import { formatPromptForDisplay } from "./utils/format";
import { addToHistory } from "./utils/history";
import HistoryCommand from "./history";
import Templates from "./templates";
import SaveTemplate from "./save-template";
import ResolveAmbiguity from "./resolve-ambiguity";
import { applyTemplate } from "./utils/templates";

export default function Command() {
  const [prompt, setPrompt] = useState("");
  const [selectedEngine, setSelectedEngine] = useState(engines[0].name);
  const [selectedModel, setSelectedModel] = useState(() => getDefaultModel(engines[0]));
  const [selectedMode, setSelectedMode] = useState<OptimizationMode>("quick");
  const [additionalContext, setAdditionalContext] = useState("");
  const [selectedPersona, setSelectedPersona] = useState("prompt_engineer");
  const [smartMode, setSmartMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { push, pop } = useNavigation();

  // Persona definitions moved to utils/engines.ts
  // Persona definitions moved to utils/engines.ts

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

  // Dynamic Variable Extraction
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  useEffect(() => {
    // Regex to find {{variable}}
    const matches = prompt.match(/\{\{([^}]+)\}\}/g);
    if (matches) {
      const uniqueVars = Array.from(new Set(matches.map((m) => m.slice(2, -2).trim())));
      setTemplateVariables(uniqueVars);

      // Preserve existing values for vars that still exist, clear others
      setVariableValues((prev) => {
        const next: Record<string, string> = {};
        uniqueVars.forEach((v) => {
          next[v] = prev[v] || "";
        });
        return next;
      });
    } else {
      setTemplateVariables([]);
      // Don't clear values strictly if we want to remember them?
      // Better to clear if they don't exist in prompt to keep state clean.
      setVariableValues({});
    }
  }, [prompt]);

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

    setIsLoading(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Optimizing prompt...",
    });

    let statusMessage = "Optimizing prompt";
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      toast.title = `${statusMessage}… ${elapsed}s`;
    }, 500);

    try {
      const engine = currentEngine;
      if (!engine) {
        throw new Error("Selected engine not found");
      }

      const modelToUse = engine.models?.length
        ? (ensureValidModel(selectedModel, engine) ?? getDefaultModel(engine))
        : undefined;

      // Apply variable substitution
      const finalPrompt = applyTemplate(prompt, variableValues);

      let optimizedPrompt = "";
      let results: { persona: string; output: string }[] = [];
      let personasToRun: string[] = [];

      if (smartMode) {
        // ORCHESTRATOR FLOW
        statusMessage = "Analyzing intent";
        toast.title = `${statusMessage}...`;

        // 1. Classify
        const classification = await classifyIntent(finalPrompt, additionalContext || "");
        personasToRun = classification.personas.length > 0 ? classification.personas : ["prompt_engineer"];

        // 2. Run Specialists
        statusMessage = `Consulting ${personasToRun.length} specialists`;
        toast.title = `${statusMessage}...`;

        // Parallel execution
        results = await Promise.all(
          personasToRun.map(async (p) => {
            const output = await engine.run(finalPrompt, modelToUse, selectedMode, additionalContext, p);
            return { persona: p, output };
          }),
        );

        // 3. Synthesize if needed
        if (results.length > 1) {
          statusMessage = "Synthesizing results";
          toast.title = `${statusMessage}...`;
          optimizedPrompt = await synthesizeResults(finalPrompt, results);
        } else {
          optimizedPrompt = results[0].output;
        }
      } else {
        // STANDARD FLOW
        optimizedPrompt = await engine.run(finalPrompt, modelToUse, selectedMode, additionalContext, selectedPersona);
      }

      const totalSec = ((Date.now() - start) / 1000).toFixed(1);
      toast.style = Toast.Style.Success;
      toast.title = `Prompt optimized in ${totalSec}s`;

      // Save to history
      await addToHistory({
        originalPrompt: prompt,
        optimizedPrompt,
        additionalContext: additionalContext || undefined,
        engine: engine.displayName,
        model: modelToUse,
        mode: selectedMode,
        persona: smartMode ? "Orchestrator" : selectedPersona,
        durationSec: totalSec,
        specialistOutputs: smartMode && results.length > 0 ? results : undefined,
      });

      const modeLabel = OPTIMIZATION_MODES.find((m) => m.id === selectedMode)?.label ?? selectedMode;
      const modeColor = selectedMode === "detailed" ? Color.Blue : Color.Green;

      const contextSection = additionalContext ? `\n\n---\n\n## Additional Context\n\n${additionalContext}` : "";

      push(
        <Detail
          markdown={`# Optimized Prompt\n\n${formatPromptForDisplay(optimizedPrompt)}\n\n---\n\n## Original Prompt\n\n${prompt}${contextSection}${smartMode && results.length > 0 ? `\n\n---\n\n## Specialist Perspectives\n\n${results.map((s) => `### ${PERSONAS.find((p) => p.id === s.persona)?.title || s.persona}\n\n${s.output}`).join("\n\n---\n\n")}` : ""}`}
          metadata={
            <Detail.Metadata>
              <Detail.Metadata.TagList title="Mode">
                <Detail.Metadata.TagList.Item text={modeLabel} color={modeColor} />
              </Detail.Metadata.TagList>
              <Detail.Metadata.Separator />
              <Detail.Metadata.Label title="Engine" text={engine.displayName} icon={engine.icon} />
              {modelToUse && <Detail.Metadata.Label title="Model" text={modelToUse} />}
              <Detail.Metadata.Label
                title="Persona"
                text={
                  smartMode
                    ? "Smart Orchestrator"
                    : (PERSONAS.find((p) => p.id === selectedPersona)?.title ?? selectedPersona)
                }
                icon={smartMode ? Icon.Stars : PERSONAS.find((p) => p.id === selectedPersona)?.icon}
              />
              {smartMode && personasToRun.length > 0 && (
                <Detail.Metadata.TagList title="Active Specialists">
                  {personasToRun.map((specialistId) => {
                    const p = PERSONAS.find((persona) => persona.id === specialistId);
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
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to optimize prompt";
      toast.message = error instanceof Error ? error.message : String(error);
    } finally {
      clearInterval(timer);
      setIsLoading(false);
    }
  }

  async function handleCriticSubmit() {
    if (!prompt.trim()) {
      showToast({ style: Toast.Style.Failure, title: "Prompt cannot be empty" });
      return;
    }

    const engine = currentEngine;
    if (!engine) return;

    setIsLoading(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Auditing prompt..." });

    try {
      const finalPrompt = applyTemplate(prompt, variableValues);
      const modelToUse = engine.models?.length
        ? (ensureValidModel(selectedModel, engine) ?? getDefaultModel(engine))
        : undefined;

      // Pass 1: Audit
      const questions = await engine.audit(finalPrompt, modelToUse, additionalContext, selectedPersona);

      if (questions.length === 0) {
        toast.title = "No ambiguity found. Optimizing...";
        await handleSubmit(); // Fallback to standard flow
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
          mode={selectedMode}
        />,
      );
    } catch (error) {
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
            shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
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
            shortcut={{ modifiers: ["cmd"], key: "k" }}
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
        id="mode"
        title="Mode"
        value={selectedMode}
        onChange={(value) => setSelectedMode(value as OptimizationMode)}
        info="Quick: Comprehensive single-shot. Detailed: Phased with approval checkpoints."
      >
        <Form.Dropdown.Item value="quick" title="Quick" icon={{ source: Icon.Bolt, tintColor: Color.Green }} />
        <Form.Dropdown.Item value="detailed" title="Detailed" icon={{ source: Icon.List, tintColor: Color.Blue }} />
      </Form.Dropdown>
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
      <Form.Description text="⌘H for history" />
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
