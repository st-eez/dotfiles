import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export type ThemeColors = {
  bg0: string;
  bg1: string;
  bg2: string;
  fg: string;
  grey: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  orange: string;
};

export type Theme = {
  id: string;
  name: string;
  colors: ThemeColors;
};

export type LoadThemesResult = { success: true; themes: Theme[] } | { success: false; error: string };

export const COLOR_KEYS: (keyof ThemeColors)[] = [
  "bg0",
  "bg1",
  "bg2",
  "fg",
  "grey",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "orange",
];

function isValidTheme(theme: unknown): theme is Theme {
  if (typeof theme !== "object" || theme === null) return false;
  const t = theme as Record<string, unknown>;
  if (typeof t.id !== "string" || typeof t.name !== "string") return false;
  if (typeof t.colors !== "object" || t.colors === null) return false;
  const colors = t.colors as Record<string, unknown>;
  return COLOR_KEYS.every((key) => typeof colors[key] === "string");
}

export function loadThemes(): LoadThemesResult {
  const dotfiles = process.env.DOTFILES || join(homedir(), "Projects/Personal/dotfiles");
  const manifestPath = join(dotfiles, "themes", "themes.json");

  try {
    const content = readFileSync(manifestPath, "utf-8");
    const manifest: unknown = JSON.parse(content);

    if (typeof manifest !== "object" || manifest === null) {
      return { success: false, error: "Invalid themes.json: expected object" };
    }

    const m = manifest as Record<string, unknown>;
    if (!Array.isArray(m.themes)) {
      return { success: false, error: "Invalid themes.json: missing themes array" };
    }

    const validThemes: Theme[] = [];
    for (const theme of m.themes) {
      if (!isValidTheme(theme)) {
        return {
          success: false,
          error: `Invalid theme "${(theme as Record<string, unknown>)?.id ?? "unknown"}": missing required color keys`,
        };
      }
      validThemes.push(theme);
    }

    return {
      success: true,
      themes: validThemes.sort((a, b) => a.name.localeCompare(b.name)),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Failed to load ${manifestPath}: ${message}` };
  }
}
