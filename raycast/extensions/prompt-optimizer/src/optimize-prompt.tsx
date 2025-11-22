import { Action, ActionPanel, Form, showToast, Toast, useNavigation, Detail } from "@raycast/api";
import { useEffect, useState } from "react";
import { engines } from "./utils/engines";
import { addToHistory } from "./utils/history";
import HistoryCommand from "./history";

export default function Command() {
  const [prompt, setPrompt] = useState("");
  const [selectedEngine, setSelectedEngine] = useState(engines[0].name);
  const [selectedModel, setSelectedModel] = useState(() => getDefaultModel(engines[0]));
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
      const optimizedPrompt = await engine.run(prompt, modelToUse);

      const totalSec = ((Date.now() - start) / 1000).toFixed(1);
      toast.style = Toast.Style.Success;
      toast.title = `Prompt optimized in ${totalSec}s`;

      // Save to history
      await addToHistory({
        originalPrompt: prompt,
        optimizedPrompt,
        engine: engine.displayName,
        model: modelToUse,
        durationSec: totalSec,
      });

      push(
        <Detail
          markdown={`# Optimized Prompt\n\n${optimizedPrompt}`}
          metadata={
            <Detail.Metadata>
              <Detail.Metadata.Label title="Engine" text={engine.displayName} />
              {modelToUse && <Detail.Metadata.Label title="Model" text={modelToUse} />}
              <Detail.Metadata.Label title="Duration" text={`${totalSec}s`} />
            </Detail.Metadata>
          }
          actions={
            <ActionPanel>
              <Action.CopyToClipboard content={optimizedPrompt} />
            </ActionPanel>
          }
        />,
      );
    } catch (error: any) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to optimize prompt";
      toast.message = error.message;
    } finally {
      clearInterval(timer);
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Optimize Prompt" onSubmit={handleSubmit} />
          <Action.Push title="View History" target={<HistoryCommand />} shortcut={{ modifiers: ["cmd"], key: "h" }} />
        </ActionPanel>
      }
    >
      <Form.Description text="Press ⌘H to view full history" />
      <Form.TextArea
        id="prompt"
        title="Prompt"
        placeholder="Enter your prompt here..."
        value={prompt}
        onChange={setPrompt}
      />
      <Form.Dropdown id="engine" title="Engine" value={selectedEngine} onChange={handleEngineChange}>
        {engines.map((engine) => (
          <Form.Dropdown.Item key={engine.name} value={engine.name} title={engine.displayName} />
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
