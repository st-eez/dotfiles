import { Action, ActionPanel, Color, Detail, Icon, List, showToast, Toast, confirmAlert, Alert } from "@raycast/api";
import { useEffect, useState } from "react";
import { getHistory, clearHistory, removeFromHistory, HistoryItem } from "./utils/history";
import { getPersonaTitle, getPersonaIcon } from "./utils/engines";
import { formatPromptForDisplay, buildResultMarkdown } from "./utils/format";
import { homedir } from "os";
import { writeFile } from "fs/promises";
import { join } from "path";

type DateGroup = "Today" | "Yesterday" | "This Week" | "Older";

function getDateGroup(timestamp: number): DateGroup {
  const now = new Date();
  const date = new Date(timestamp);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (date >= today) return "Today";
  if (date >= yesterday) return "Yesterday";
  if (date >= weekAgo) return "This Week";
  return "Older";
}

function groupHistoryByDate(items: HistoryItem[]): Record<DateGroup, HistoryItem[]> {
  const groups: Record<DateGroup, HistoryItem[]> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    Older: [],
  };

  items.forEach((item) => {
    const group = getDateGroup(item.timestamp);
    groups[group].push(item);
  });

  return groups;
}

function getEngineIcon(engine: string): Icon {
  switch (engine.toLowerCase()) {
    case "codex":
      return Icon.Code;
    case "gemini":
      return Icon.Stars;
    case "opencode":
      return Icon.Terminal;
    case "claude":
      return Icon.Message;
    default:
      return Icon.Dot;
  }
}

function extractTitle(text: string, maxLength: number = 80): string {
  const cleaned = text.replace(/\n/g, " ").trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) + "…" : cleaned;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function HistoryCommand() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setIsLoading(true);
    const items = await getHistory();
    setHistory(items);
    setIsLoading(false);
  }

  async function handleClearHistory() {
    if (
      await confirmAlert({
        title: "Clear History",
        message: "Are you sure you want to clear all history? This action cannot be undone.",
        primaryAction: {
          title: "Clear History",
          style: Alert.ActionStyle.Destructive,
        },
      })
    ) {
      await clearHistory();
      setHistory([]);
      showToast({ style: Toast.Style.Success, title: "History cleared" });
    }
  }

  async function handleDeleteItem(id: string) {
    await removeFromHistory(id);
    setHistory((prev) => prev.filter((item) => item.id !== id));
    showToast({ style: Toast.Style.Success, title: "Item deleted" });
  }

  async function handleExportHistory() {
    if (history.length === 0) {
      showToast({ style: Toast.Style.Failure, title: "No history to export" });
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `prompt_history_${timestamp}.md`;
    const filePath = join(homedir(), "Downloads", filename);

    let markdown = "# Prompt Optimization History\n\n";
    markdown += `Exported on: ${new Date().toLocaleString()}\n\n`;

    history.forEach((item) => {
      markdown += `## ${new Date(item.timestamp).toLocaleString()}\n\n`;
      markdown += `**Engine:** ${item.engine} ${item.model ? `(${item.model})` : ""}\n`;
      if (item.persona) {
        markdown += `**Persona:** ${getPersonaTitle(item.persona)}\n`;
      }
      markdown += `**Duration:** ${item.durationSec}s\n\n`;
      markdown += `### Original Prompt\n\n${item.originalPrompt}\n\n`;
      if (item.additionalContext) {
        markdown += `### Additional Context\n\n${item.additionalContext}\n\n`;
      }
      markdown += `### Optimized Prompt\n\n${item.optimizedPrompt}\n\n`;
      markdown += `---\n\n`;
    });

    try {
      await writeFile(filePath, markdown);
      showToast({
        style: Toast.Style.Success,
        title: "History Exported",
        message: `Saved to Downloads/${filename}`,
      });
    } catch (error: unknown) {
      showToast({
        style: Toast.Style.Failure,
        title: "Export Failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const groupedHistory = groupHistoryByDate(history);
  const dateGroups: DateGroup[] = ["Today", "Yesterday", "This Week", "Older"];

  function renderHistoryItem(item: HistoryItem) {
    const wordCount = countWords(item.optimizedPrompt);
    const charCount = item.optimizedPrompt.length;

    return (
      <List.Item
        key={item.id}
        title={extractTitle(item.originalPrompt)}
        icon={getEngineIcon(item.engine)}
        keywords={[item.originalPrompt, item.optimizedPrompt, item.engine, item.model ?? ""].filter(Boolean)}
        accessories={[{ date: new Date(item.timestamp) }]}
        detail={
          <List.Item.Detail
            markdown={formatPromptForDisplay(item.optimizedPrompt)}
            metadata={
              <List.Item.Detail.Metadata>
                <List.Item.Detail.Metadata.Label title="Source" text={item.engine} icon={getEngineIcon(item.engine)} />
                {item.persona && (
                  <List.Item.Detail.Metadata.Label
                    title="Persona"
                    text={getPersonaTitle(item.persona)}
                    icon={getPersonaIcon(item.persona)}
                  />
                )}
                <List.Item.Detail.Metadata.Separator />
                <List.Item.Detail.Metadata.Label title="Characters" text={charCount.toString()} />
                <List.Item.Detail.Metadata.Label title="Words" text={wordCount.toString()} />
                <List.Item.Detail.Metadata.Separator />
                <List.Item.Detail.Metadata.Label title="Original Input" text={item.originalPrompt} />
                {item.additionalContext && (
                  <List.Item.Detail.Metadata.Label title="Context" text={item.additionalContext} />
                )}
                <List.Item.Detail.Metadata.Label title="Created" text={new Date(item.timestamp).toLocaleString()} />
              </List.Item.Detail.Metadata>
            }
          />
        }
        actions={
          <ActionPanel>
            <Action.Push
              title="View Full Details"
              icon={Icon.Eye}
              target={
                <Detail
                  markdown={buildResultMarkdown({
                    optimizedPrompt: item.optimizedPrompt,
                    originalPrompt: item.originalPrompt,
                    additionalContext: item.additionalContext,
                    specialistOutputs: item.specialistOutputs,
                    getPersonaTitle,
                  })}
                  metadata={
                    <Detail.Metadata>
                      <Detail.Metadata.Label title="Engine" text={item.engine} icon={getEngineIcon(item.engine)} />
                      {item.model && <Detail.Metadata.Label title="Model" text={item.model} />}
                      {item.persona && (
                        <Detail.Metadata.Label
                          title="Persona"
                          text={getPersonaTitle(item.persona)}
                          icon={item.persona === "Orchestrator" ? Icon.Stars : getPersonaIcon(item.persona)}
                        />
                      )}
                      {item.specialistOutputs && item.specialistOutputs.length > 0 && (
                        <Detail.Metadata.TagList title="Active Specialists">
                          {item.specialistOutputs.map((s) => (
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
                      <Detail.Metadata.Label title="Duration" text={`${item.durationSec}s`} icon={Icon.Clock} />
                      <Detail.Metadata.Label title="Date" text={new Date(item.timestamp).toLocaleString()} />
                      <Detail.Metadata.Label title="Original Input" text={item.originalPrompt} />
                      <Detail.Metadata.Label title="Original Length" text={`${item.originalPrompt.length} chars`} />
                      <Detail.Metadata.Label title="Optimized Length" text={`${item.optimizedPrompt.length} chars`} />
                    </Detail.Metadata>
                  }
                  actions={
                    <ActionPanel>
                      <Action.CopyToClipboard content={item.optimizedPrompt} />
                    </ActionPanel>
                  }
                />
              }
            />
            <Action.CopyToClipboard
              title="Copy Optimized Prompt"
              content={item.optimizedPrompt}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
            <Action.CopyToClipboard
              title="Copy Original Prompt"
              content={item.originalPrompt}
              shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
            />
            <ActionPanel.Section>
              <Action
                title="Export All History"
                icon={Icon.Download}
                onAction={handleExportHistory}
                shortcut={{ modifiers: ["cmd"], key: "e" }}
              />
            </ActionPanel.Section>
            <ActionPanel.Section>
              <Action
                title="Delete Item"
                icon={Icon.Trash}
                onAction={() => handleDeleteItem(item.id)}
                style={Action.Style.Destructive}
                shortcut={{ modifiers: ["cmd"], key: "backspace" }}
              />
              <Action
                title="Clear All History"
                icon={Icon.XMarkCircle}
                onAction={handleClearHistory}
                style={Action.Style.Destructive}
              />
            </ActionPanel.Section>
          </ActionPanel>
        }
      />
    );
  }

  return (
    <List isLoading={isLoading} isShowingDetail searchBarPlaceholder="Search history...">
      {history.length === 0 ? (
        <List.EmptyView title="No history yet" description="Optimized prompts will appear here." icon={Icon.Clock} />
      ) : (
        dateGroups.map((group) => {
          const items = groupedHistory[group];
          if (items.length === 0) return null;

          return (
            <List.Section key={group} title={group} subtitle={`${items.length} item${items.length > 1 ? "s" : ""}`}>
              {items.map(renderHistoryItem)}
            </List.Section>
          );
        })
      )}
    </List>
  );
}
