import { Action, ActionPanel, Color, Form, showToast, Toast, useNavigation, Detail, Icon } from "@raycast/api";
import { useEffect, useState } from "react";
import { engines, OPTIMIZATION_MODES, type OptimizationMode } from "./utils/engines";
import { formatPromptForDisplay } from "./utils/format";
import { addToHistory } from "./utils/history";
import HistoryCommand from "./history";

export default function Command() {
  const [prompt, setPrompt] = useState("");
  const [selectedEngine, setSelectedEngine] = useState(engines[0].name);
  const [selectedModel, setSelectedModel] = useState(() => getDefaultModel(engines[0]));
  const [selectedMode, setSelectedMode] = useState<OptimizationMode>("quick");
  const [isLoading, setIsLoading] = useState(false);
  const { push } = useNavigation();

  const currentEngine = engines.find((e) => e.name === selectedEngine);

  useEffect(() => {
    if (currentEngine) {
      setSelectedModel(getDefaultModel(currentEngine));
    }
  }, [selectedEngine, currentEngine]);

  function handleEngineChange(engineName: string) {
    setSelectedEngine(engineName);
    const engine = engines.find((e) => e.name === engineName);
    setSelectedModel(getDefaultModel(engine));
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
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      toast.title = `Optimizing prompt… ${elapsed}s`;
    }, 500);

    try {
      const engine = currentEngine;
      if (!engine) {
        throw new Error("Selected engine not found");
      }

      const modelToUse = engine.models?.length
        ? (ensureValidModel(selectedModel, engine) ?? getDefaultModel(engine))
        : undefined;
      const optimizedPrompt = await engine.run(prompt, modelToUse, selectedMode);

      const totalSec = ((Date.now() - start) / 1000).toFixed(1);
      toast.style = Toast.Style.Success;
      toast.title = `Prompt optimized in ${totalSec}s`;

      // Save to history
      await addToHistory({
        originalPrompt: prompt,
        optimizedPrompt,
        engine: engine.displayName,
        model: modelToUse,
        mode: selectedMode,
        durationSec: totalSec,
      });

      const modeLabel = OPTIMIZATION_MODES.find((m) => m.id === selectedMode)?.label ?? selectedMode;
      const modeColor = selectedMode === "detailed" ? Color.Blue : Color.Green;

      push(
        <Detail
          markdown={`# Optimized Prompt\n\n${formatPromptForDisplay(optimizedPrompt)}\n\n---\n\n## Original Prompt\n\n${prompt}`}
          metadata={
            <Detail.Metadata>
              <Detail.Metadata.TagList title="Mode">
                <Detail.Metadata.TagList.Item text={modeLabel} color={modeColor} />
              </Detail.Metadata.TagList>
              <Detail.Metadata.Separator />
              <Detail.Metadata.Label title="Engine" text={engine.displayName} icon={engine.icon} />
              {modelToUse && <Detail.Metadata.Label title="Model" text={modelToUse} />}
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

  return (
    <Form
      navigationTitle="Prompt Optimizer"
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Optimize Prompt" onSubmit={handleSubmit} />
          <Action.Push title="View History" target={<HistoryCommand />} shortcut={{ modifiers: ["cmd"], key: "h" }} />
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
