import { LocalStorage, environment, showToast, Toast, getPreferenceValues } from "@raycast/api";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";

export interface Template {
  id: string;
  name: string;
  content: string; // The raw prompt pattern with {{variables}}
  variables: string[];
  createdAt: number;
  isShared?: boolean; // True if stored in templates.json
}

const TEMPLATES_KEY = "prompt-optimizer-templates";
const SHARED_FILENAME = "templates.json";

function getSharedTemplatesPath(): string {
  const prefs = getPreferenceValues<{ templatesPath?: string }>();
  if (prefs.templatesPath) {
    // If user provided a path, use it. Validation logic could be added here.
    return path.join(prefs.templatesPath, SHARED_FILENAME);
  }
  // Use assetsPath (which points to ./assets) and go up one level to reach extension root
  return path.join(environment.assetsPath, "..", SHARED_FILENAME);
}

function getSharedTemplates(): Template[] {
  const filePath = getSharedTemplatesPath();
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const data = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(data).map((t: Template) => ({ ...t, isShared: true }));
}

export async function getTemplates(): Promise<Template[]> {
  let localTemplates: Template[] = [];
  try {
    const localJson = await LocalStorage.getItem<string>(TEMPLATES_KEY);
    localTemplates = localJson ? JSON.parse(localJson) : [];
  } catch (error) {
    console.error("Failed to parse local templates:", error);
    showToast({ title: "Error loading local templates", message: "Data reset", style: Toast.Style.Failure });
    // Fallback to empty to prevent UI crash
    localTemplates = [];
  }

  let sharedTemplates: Template[] = [];
  try {
    sharedTemplates = getSharedTemplates();
  } catch (error) {
    console.error("Failed to read shared templates:", error);
    showToast({
      title: "Error loading shared templates",
      message: "Check templates.json for syntax errors",
      style: Toast.Style.Failure,
    });
  }

  // Return combined list, sorted by date DESC
  return [...localTemplates, ...sharedTemplates].sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveTemplate(name: string, content: string): Promise<Template> {
  // Check for duplicates
  const allTemplates = await getTemplates();
  if (allTemplates.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`Template "${name}" already exists`);
  }

  let templates: Template[] = [];
  try {
    const json = await LocalStorage.getItem<string>(TEMPLATES_KEY);
    templates = json ? JSON.parse(json) : [];
  } catch (err) {
    console.error("Failed to parse local templates during save", err);
  }

  // Extract variables
  const matches = content.match(/\{\{([^}]+)\}\}/g);
  const variables = matches ? Array.from(new Set(matches.map((m) => m.slice(2, -2).trim()))) : [];

  const newTemplate: Template = {
    id: randomUUID(),
    name,
    content,
    variables,
    createdAt: Date.now(),
    isShared: false,
  };

  const updated = [newTemplate, ...templates];
  await LocalStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
  return newTemplate;
}

export async function deleteTemplate(id: string, isShared: boolean): Promise<void> {
  if (isShared) {
    // Read -> Filter -> Write JSON
    try {
      const filePath = getSharedTemplatesPath();
      const current = getSharedTemplates();
      // Filter out the one to delete. Note: getSharedTemplates adds isShared=true, but in file it might not be there.
      // We rely on ID match.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const updated = current.filter((t) => t.id !== id).map(({ isShared, ...t }) => t); // Strip isShared before writing
      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
      showToast({ title: "Shared template deleted", style: Toast.Style.Success });
    } catch (error) {
      showToast({ title: "Failed to delete shared template", message: String(error), style: Toast.Style.Failure });
    }
  } else {
    // LocalStorage deletion
    try {
      const json = await LocalStorage.getItem<string>(TEMPLATES_KEY);
      const templates: Template[] = json ? JSON.parse(json) : [];
      const updated = templates.filter((t) => t.id !== id);
      await LocalStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to delete local template", e);
      throw new Error("Failed to update local storage");
    }
  }
}

export async function promoteTemplate(template: Template): Promise<void> {
  try {
    const filePath = getSharedTemplatesPath();
    const currentShared = getSharedTemplates();

    // Check for duplicates by ID
    if (currentShared.find((t) => t.id === template.id)) {
      throw new Error("Template already exists in shared storage");
    }

    // Prepare template for file (strip isShared)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isShared, ...cleanTemplate } = template;

    // Append
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const updated = [cleanTemplate, ...currentShared.map(({ isShared, ...t }) => t)];

    // 1. Remove from LocalStorage FIRST (Optimistic update / prepare)
    // We need to fetch local templates manually to be able to rollback
    let localTemplates: Template[] = [];
    try {
      const json = await LocalStorage.getItem<string>(TEMPLATES_KEY);
      localTemplates = json ? JSON.parse(json) : [];
    } catch {
      /* ignore */
    }

    const updatedLocal = localTemplates.filter((t) => t.id !== template.id);
    await LocalStorage.setItem(TEMPLATES_KEY, JSON.stringify(updatedLocal));

    // 2. Write to File
    try {
      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
    } catch (writeError) {
      // ROLLBACK: Restore LocalStorage
      await LocalStorage.setItem(TEMPLATES_KEY, JSON.stringify(localTemplates));
      throw writeError;
    }

    showToast({
      title: "Template Promoted to Shared",
      message: "Changes saved to templates.json",
      style: Toast.Style.Success,
    });
  } catch (error) {
    showToast({ title: "Failed to promote template", message: String(error), style: Toast.Style.Failure });
    throw error;
  }
}

// Helper to substitute variables into the template content
export function applyTemplate(content: string, values: Record<string, string>): string {
  let result = content;
  Object.entries(values).forEach(([key, value]) => {
    // Replace all occurrences of {{key}} with value
    // Escaping key for regex just in case
    const regex = new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, "g");
    result = result.replace(regex, value);
  });
  return result;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function updateTemplate(id: string, name: string, content: string, isShared: boolean): Promise<void> {
  // Check for duplicate name (excluding self)
  const allTemplates = await getTemplates();
  if (allTemplates.some((t) => t.name.toLowerCase() === name.toLowerCase() && t.id !== id)) {
    throw new Error(`Template "${name}" already exists`);
  }

  // Extract variables
  const matches = content.match(/\{\{([^}]+)\}\}/g);
  const variables = matches ? Array.from(new Set(matches.map((m) => m.slice(2, -2).trim()))) : [];

  if (isShared) {
    // Shared: Read -> Find -> Update -> Write
    const filePath = getSharedTemplatesPath();
    const currentShared = getSharedTemplates();
    const index = currentShared.findIndex((t) => t.id === id);

    if (index === -1) throw new Error("Shared template not found");

    currentShared[index] = {
      ...currentShared[index],
      name,
      content,
      variables,
    };

    // Remove isShared for file writing
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const forFile = currentShared.map(({ isShared, ...t }) => t);
    fs.writeFileSync(filePath, JSON.stringify(forFile, null, 2));

    showToast({ title: "Shared template updated", style: Toast.Style.Success });
  } else {
    // Local: Read -> Find -> Update -> Write
    try {
      const json = await LocalStorage.getItem<string>(TEMPLATES_KEY);
      const localTemplates: Template[] = json ? JSON.parse(json) : [];
      const index = localTemplates.findIndex((t) => t.id === id);

      if (index === -1) throw new Error("Local template not found");

      localTemplates[index] = {
        ...localTemplates[index],
        name,
        content,
        variables,
      };

      await LocalStorage.setItem(TEMPLATES_KEY, JSON.stringify(localTemplates));
      showToast({ title: "Template updated", style: Toast.Style.Success });
    } catch (error) {
      console.error("Failed to update local template", error);
      throw new Error("Failed to update local storage");
    }
  }
}
