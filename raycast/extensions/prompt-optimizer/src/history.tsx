import { Action, ActionPanel, Detail, List, showToast, Toast, confirmAlert, Alert } from "@raycast/api";
import { useEffect, useState } from "react";
import { getHistory, clearHistory, HistoryItem } from "./utils/history";
import { homedir } from "os";
import { writeFile } from "fs/promises";
import { join } from "path";

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
      markdown += `**Duration:** ${item.durationSec}s\n\n`;
      markdown += `### Original Prompt\n\n${item.originalPrompt}\n\n`;
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
    } catch (error: any) {
      showToast({
        style: Toast.Style.Failure,
        title: "Export Failed",
        message: error.message,
      });
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search history...">
      {history.length === 0 ? (
        <List.EmptyView title="No history yet" description="Optimized prompts will appear here." />
      ) : (
        history.map((item) => (
          <List.Item
            key={item.id}
            title={item.originalPrompt}
            subtitle={`${item.engine} ${item.model ? `(${item.model})` : ""} • ${item.durationSec}s`}
            accessories={[{ date: new Date(item.timestamp), tooltip: new Date(item.timestamp).toLocaleString() }]}
            actions={
              <ActionPanel>
                <Action.Push
                  title="View Details"
                  target={
                    <Detail
                      markdown={`# Optimized Prompt\n\n${item.optimizedPrompt}\n\n---\n\n### Original Prompt\n\n${item.originalPrompt}`}
                      metadata={
                        <Detail.Metadata>
                          <Detail.Metadata.Label title="Engine" text={item.engine} />
                          {item.model && <Detail.Metadata.Label title="Model" text={item.model} />}
                          <Detail.Metadata.Label title="Duration" text={`${item.durationSec}s`} />
                          <Detail.Metadata.Label
                            title="Date"
                            text={new Date(item.timestamp).toLocaleString()}
                          />
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
                <Action.CopyToClipboard title="Copy Optimized Prompt" content={item.optimizedPrompt} />
                <Action.CopyToClipboard title="Copy Original Prompt" content={item.originalPrompt} />
                <Action title="Export History to Downloads" onAction={handleExportHistory} icon="⬇️" />
                <Action title="Clear History" onAction={handleClearHistory} style={Action.Style.Destructive} />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
