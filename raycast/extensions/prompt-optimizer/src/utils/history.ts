import { LocalStorage } from "@raycast/api";
import { randomUUID } from "crypto";

export interface HistoryItem {
  id: string;
  originalPrompt: string;
  optimizedPrompt: string;
  engine: string;
  model?: string;
  durationSec: string;
  timestamp: number;
}

const HISTORY_KEY = "prompt-optimizer-history";

export async function getHistory(): Promise<HistoryItem[]> {
  const json = await LocalStorage.getItem<string>(HISTORY_KEY);
  return json ? JSON.parse(json) : [];
}

export async function addToHistory(item: Omit<HistoryItem, "id" | "timestamp">) {
  const history = await getHistory();
  const newItem: HistoryItem = {
    ...item,
    id: randomUUID(),
    timestamp: Date.now(),
  };
  // Keep last 100 items
  const updated = [newItem, ...history].slice(0, 100);
  await LocalStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return newItem;
}

export async function clearHistory() {
  await LocalStorage.removeItem(HISTORY_KEY);
}
