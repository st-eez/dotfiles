import { List, ActionPanel, Action, showToast, Toast, Icon } from "@raycast/api";
import { useExec, showFailureToast } from "@raycast/utils";
import { execFile } from "child_process";
import { promisify } from "util";
import { useMemo, useState, useRef, useEffect } from "react";
import { homedir } from "os";
import { join } from "path";
import { loadThemes, ThemeColors, COLOR_KEYS } from "./themes";

const execFileAsync = promisify(execFile);

const COLOR_LABELS: Record<keyof ThemeColors, string> = {
  bg0: "Background",
  bg1: "Surface",
  bg2: "Muted BG",
  fg: "Foreground",
  grey: "Grey",
  red: "Red",
  green: "Green",
  yellow: "Yellow",
  blue: "Blue",
  magenta: "Magenta",
  cyan: "Cyan",
  orange: "Orange",
};

const CURRENT_THEME_PATH = join(homedir(), ".config", "current-theme");
const THEME_SET_PATH = join(homedir(), ".local", "bin", "theme-set");

export default function Command() {
  const themesResult = useMemo(() => loadThemes(), []);
  const switchingRef = useRef(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const {
    isLoading,
    data: currentThemeRaw,
    revalidate,
  } = useExec("cat", [CURRENT_THEME_PATH], {
    initialData: "tokyo-night",
    onError: (error) => {
      showFailureToast(error, { title: "Failed to read current theme" });
    },
  });

  useEffect(() => {
    if (!themesResult.success) {
      showFailureToast(new Error(themesResult.error), { title: "Failed to load themes" });
    }
  }, [themesResult]);

  const themes = themesResult.success ? themesResult.themes : [];
  const currentTheme = currentThemeRaw?.toString().trim() || "tokyo-night";

  const switchTheme = async (themeId: string) => {
    if (themeId === currentTheme || switchingRef.current) return;

    switchingRef.current = true;
    setIsSwitching(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Switching theme...",
    });

    try {
      await execFileAsync(THEME_SET_PATH, [themeId]);
      revalidate();
      toast.style = Toast.Style.Success;
      toast.title = `Switched to ${themes.find((t) => t.id === themeId)?.name}`;
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to switch theme";
      toast.message = error instanceof Error ? error.message : String(error);
    } finally {
      switchingRef.current = false;
      setIsSwitching(false);
    }
  };

  const getThemePreview = (c: ThemeColors) => {
    const width = 600;
    const height = 300;

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <!-- Background -->
        <rect width="100%" height="100%" fill="${c.bg0}" />
        
        <!-- Window chrome -->
        <rect x="0" y="0" width="600" height="32" fill="${c.bg1}" />
        <circle cx="20" cy="16" r="6" fill="${c.red}" />
        <circle cx="40" cy="16" r="6" fill="${c.yellow}" />
        <circle cx="60" cy="16" r="6" fill="${c.green}" />
        
        <!-- Sidebar -->
        <rect x="0" y="32" width="140" height="268" fill="${c.bg1}" />
        
        <!-- Sidebar items -->
        <rect x="8" y="48" width="124" height="24" rx="4" fill="${c.blue}" fill-opacity="0.2" />
        <rect x="16" y="56" width="80" height="8" rx="2" fill="${c.blue}" />
        
        <rect x="16" y="88" width="70" height="8" rx="2" fill="${c.fg}" fill-opacity="0.6" />
        <rect x="16" y="108" width="90" height="8" rx="2" fill="${c.fg}" fill-opacity="0.6" />
        <rect x="16" y="128" width="60" height="8" rx="2" fill="${c.fg}" fill-opacity="0.6" />
        
        <!-- Main editor area -->
        <rect x="140" y="32" width="460" height="268" fill="${c.bg0}" />
        
        <!-- Line numbers gutter -->
        <rect x="140" y="32" width="32" height="268" fill="${c.bg1}" fill-opacity="0.5" />
        <rect x="148" y="52" width="16" height="8" rx="2" fill="${c.grey}" />
        <rect x="148" y="72" width="16" height="8" rx="2" fill="${c.grey}" />
        <rect x="148" y="92" width="16" height="8" rx="2" fill="${c.grey}" />
        <rect x="148" y="112" width="16" height="8" rx="2" fill="${c.grey}" />
        <rect x="148" y="132" width="16" height="8" rx="2" fill="${c.grey}" />
        <rect x="148" y="152" width="16" height="8" rx="2" fill="${c.grey}" />
        
        <!-- Code syntax highlighting -->
        <!-- Line 1: keyword + function -->
        <rect x="184" y="52" width="48" height="8" rx="2" fill="${c.magenta}" />
        <rect x="240" y="52" width="72" height="8" rx="2" fill="${c.blue}" />
        <rect x="320" y="52" width="16" height="8" rx="2" fill="${c.fg}" />
        
        <!-- Line 2: variable + string -->
        <rect x="200" y="72" width="40" height="8" rx="2" fill="${c.fg}" />
        <rect x="248" y="72" width="16" height="8" rx="2" fill="${c.orange}" />
        <rect x="272" y="72" width="96" height="8" rx="2" fill="${c.green}" />
        
        <!-- Line 3: keyword + type -->
        <rect x="200" y="92" width="32" height="8" rx="2" fill="${c.magenta}" />
        <rect x="240" y="92" width="56" height="8" rx="2" fill="${c.cyan}" />
        <rect x="304" y="92" width="16" height="8" rx="2" fill="${c.orange}" />
        <rect x="328" y="92" width="48" height="8" rx="2" fill="${c.yellow}" />
        
        <!-- Line 4: function call -->
        <rect x="200" y="112" width="64" height="8" rx="2" fill="${c.blue}" />
        <rect x="272" y="112" width="80" height="8" rx="2" fill="${c.green}" />
        
        <!-- Line 5: error/warning -->
        <rect x="200" y="132" width="40" height="8" rx="2" fill="${c.red}" />
        <rect x="248" y="132" width="96" height="8" rx="2" fill="${c.fg}" fill-opacity="0.7" />
        
        <!-- Line 6: comment -->
        <rect x="184" y="152" width="140" height="8" rx="2" fill="${c.grey}" />
        
        <!-- Status bar -->
        <rect x="140" y="268" width="460" height="32" fill="${c.bg1}" />
        <circle cx="160" cy="284" r="5" fill="${c.green}" />
        <rect x="174" y="280" width="48" height="8" rx="2" fill="${c.fg}" fill-opacity="0.8" />
        <rect x="240" y="280" width="64" height="8" rx="2" fill="${c.blue}" />
        <rect x="320" y="280" width="40" height="8" rx="2" fill="${c.orange}" />
        
        <!-- Color palette strip -->
        <rect x="8" y="260" width="124" height="32" rx="4" fill="${c.bg2}" />
        <rect x="14" y="266" width="16" height="20" rx="2" fill="${c.red}" />
        <rect x="34" y="266" width="16" height="20" rx="2" fill="${c.orange}" />
        <rect x="54" y="266" width="16" height="20" rx="2" fill="${c.yellow}" />
        <rect x="74" y="266" width="16" height="20" rx="2" fill="${c.green}" />
        <rect x="94" y="266" width="16" height="20" rx="2" fill="${c.blue}" />
        <rect x="114" y="266" width="16" height="20" rx="2" fill="${c.magenta}" />
      </svg>
    `;

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  };

  const themePreviews = useMemo(() => {
    return themes.reduce(
      (acc, theme) => {
        acc[theme.id] = getThemePreview(theme.colors);
        return acc;
      },
      {} as Record<string, string>,
    );
  }, [themes]);

  return (
    <List isLoading={isLoading || isSwitching} isShowingDetail searchBarPlaceholder="Select a theme...">
      {themes.map((theme) => {
        const isActive = currentTheme === theme.id;
        return (
          <List.Item
            key={theme.id}
            icon={isActive ? Icon.CheckCircle : Icon.Circle}
            title={theme.name}
            subtitle={isActive ? "Active" : undefined}
            detail={
              <List.Item.Detail
                markdown={`![Color Palette](${themePreviews[theme.id]})`}
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.TagList title="Palette">
                      {COLOR_KEYS.map((key) => (
                        <List.Item.Detail.Metadata.TagList.Item
                          key={key}
                          text={COLOR_LABELS[key]}
                          color={theme.colors[key]}
                        />
                      ))}
                    </List.Item.Detail.Metadata.TagList>
                    <List.Item.Detail.Metadata.Separator />
                    <List.Item.Detail.Metadata.Label title="Status" text={isActive ? "Active" : "Inactive"} />
                  </List.Item.Detail.Metadata>
                }
              />
            }
            actions={
              <ActionPanel>
                <Action
                  title={isActive ? "Already Active" : "Set Theme"}
                  icon={isActive ? Icon.CheckCircle : Icon.Circle}
                  onAction={() => switchTheme(theme.id)}
                />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
