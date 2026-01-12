import { Detail, ActionPanel, Action, Icon, showToast, Toast, useNavigation, Color } from "@raycast/api";
import { useEffect, useState, useRef } from "react";
import { formatPromptForDisplay, buildResultMarkdown } from "../utils/format";
import { addToHistory } from "../utils/history";
import {
  getPersonaTitle,
  getPersonaIcon,
  getEngineIcon,
  type StreamingCallbacks,
  type SmartModeResult,
} from "../utils/engines";

export interface StreamingConfig {
  originalPrompt: string;
  additionalContext?: string;
  engineName: string;
  model?: string;
  persona: string;
  smartMode: boolean;
  doStream: (callbacks: StreamingCallbacks) => Promise<string>;
  doStreamSmart?: (callbacks: StreamingCallbacks) => Promise<SmartModeResult>;
}

export function StreamingDetail({ config }: { config: StreamingConfig }) {
  const { originalPrompt, engineName, model, persona, smartMode, doStream, doStreamSmart } = config;
  const { pop } = useNavigation();

  const [isStreaming, setIsStreaming] = useState(true);
  const [streamedContent, setStreamedContent] = useState("");
  const [finalResult, setFinalResult] = useState<{
    optimizedPrompt: string;
    durationMs: number;
    smartResult?: SmartModeResult;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    let mounted = true;
    abortControllerRef.current = new AbortController();
    startTimeRef.current = Date.now();

    const runStream = async () => {
      try {
        const callbacks: StreamingCallbacks = {
          onChunk: (text: string) => {
            if (mounted) {
              setStreamedContent((prev) => prev + text);
            }
          },
          abortSignal: abortControllerRef.current!.signal,
        };

        if (smartMode && doStreamSmart) {
          const smartResult = await doStreamSmart(callbacks);
          if (!mounted) return;

          const elapsed = Date.now() - startTimeRef.current;
          setFinalResult({ optimizedPrompt: smartResult.synthesis, durationMs: elapsed, smartResult });
          setIsStreaming(false);

          await addToHistory({
            originalPrompt,
            optimizedPrompt: smartResult.synthesis,
            additionalContext: config.additionalContext || undefined,
            engine: engineName,
            model,
            persona: "Orchestrator",
            durationSec: (elapsed / 1000).toFixed(1),
            specialistOutputs: smartResult.perspectives,
          });
        } else {
          const result = await doStream(callbacks);
          if (!mounted) return;

          const elapsed = Date.now() - startTimeRef.current;
          setFinalResult({ optimizedPrompt: result, durationMs: elapsed });
          setIsStreaming(false);

          await addToHistory({
            originalPrompt,
            optimizedPrompt: result,
            additionalContext: config.additionalContext || undefined,
            engine: engineName,
            model,
            persona,
            durationSec: (elapsed / 1000).toFixed(1),
          });
        }
      } catch (err: unknown) {
        if (!mounted) return;
        if (abortControllerRef.current?.signal.aborted) return;

        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setIsStreaming(false);
        showToast({ style: Toast.Style.Failure, title: "Failed to optimize", message });
      }
    };

    runStream();

    return () => {
      mounted = false;
    };
  }, [doStream, doStreamSmart, smartMode, originalPrompt, engineName, model, persona, config.additionalContext]);

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    pop();
    showToast({ style: Toast.Style.Failure, title: "Cancelled" });
  };

  const buildMarkdown = () => {
    if (error) {
      return `# Error\n\n${error}\n\n---\n\n## Original Prompt\n\n${originalPrompt}`;
    }

    if (finalResult) {
      // Use buildResultMarkdown for proper formatting (same as non-streaming path)
      return buildResultMarkdown({
        optimizedPrompt: finalResult.optimizedPrompt,
        originalPrompt,
        additionalContext: config.additionalContext,
        specialistOutputs: finalResult.smartResult?.perspectives,
        getPersonaTitle,
      });
    }

    if (streamedContent) {
      const cursor = isStreaming ? " ▊" : "";
      return `# Optimizing...\n\n${streamedContent}${cursor}\n\n---\n\n## Original Prompt\n\n${originalPrompt}`;
    }

    return `# Preparing...\n\n_Connecting to ${engineName}..._`;
  };

  const durationSec = finalResult ? (finalResult.durationMs / 1000).toFixed(1) : undefined;

  // Determine persona display
  const displayPersona = smartMode ? "Orchestrator" : persona;
  const personaIcon = smartMode ? Icon.Stars : getPersonaIcon(persona);

  return (
    <Detail
      isLoading={isStreaming}
      markdown={buildMarkdown()}
      metadata={
        <Detail.Metadata>
          {/* Static fields - visible during streaming */}
          <Detail.Metadata.Label title="Engine" text={engineName} icon={getEngineIcon(engineName)} />
          {model && <Detail.Metadata.Label title="Model" text={model} />}
          <Detail.Metadata.Label title="Persona" text={getPersonaTitle(displayPersona)} icon={personaIcon} />
          <Detail.Metadata.Label
            title="Status"
            text={error ? "Error" : isStreaming ? "Streaming..." : "Complete"}
            icon={error ? Icon.XMarkCircle : isStreaming ? Icon.Circle : Icon.CheckCircle}
          />

          {/* Dynamic fields - visible after completion */}
          {finalResult && (
            <>
              {finalResult.smartResult?.perspectives && finalResult.smartResult.perspectives.length > 0 && (
                <Detail.Metadata.TagList title="Active Specialists">
                  {finalResult.smartResult.perspectives.map((s) => (
                    <Detail.Metadata.TagList.Item
                      key={s.persona}
                      text={getPersonaTitle(s.persona)}
                      icon={getPersonaIcon(s.persona)}
                      color={Color.Magenta}
                    />
                  ))}
                </Detail.Metadata.TagList>
              )}
              <Detail.Metadata.Separator />
              {durationSec && <Detail.Metadata.Label title="Duration" text={`${durationSec}s`} icon={Icon.Clock} />}
              <Detail.Metadata.Label title="Original Input" text={originalPrompt} />
              <Detail.Metadata.Label title="Original Length" text={`${originalPrompt.length} chars`} />
              <Detail.Metadata.Label title="Optimized Length" text={`${finalResult.optimizedPrompt.length} chars`} />
            </>
          )}
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          {finalResult && (
            <>
              <Action.CopyToClipboard title="Copy Optimized Prompt" content={finalResult.optimizedPrompt} />
              <Action.CopyToClipboard
                title="Copy as Markdown"
                content={formatPromptForDisplay(finalResult.optimizedPrompt)}
                shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
              />
            </>
          )}
          {isStreaming && (
            <Action
              title="Cancel"
              icon={Icon.XMarkCircle}
              shortcut={{ modifiers: ["cmd"], key: "." }}
              onAction={handleCancel}
            />
          )}
        </ActionPanel>
      }
    />
  );
}
