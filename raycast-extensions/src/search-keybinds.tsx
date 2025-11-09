import { List } from "@raycast/api";

type ShortcutEntry = {
  binding: string;
  description: string;
};

type ShortcutSection = {
  title: string;
  entries: ShortcutEntry[];
};

const ARROWS: Record<string, string> = {
  left: "←",
  right: "→",
  up: "↑",
  down: "↓",
};

const formatKeybinding = (binding: string) =>
  binding
    .split("-")
    .map((part) => ARROWS[part] ?? part.toUpperCase())
    .join(" + ");

const keywords = (section: ShortcutSection, entry: ShortcutEntry) => {
  const textTokens = entry.description
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter(Boolean);

  return [entry.description, section.title, entry.binding, entry.binding.replace(/-/g, " "), ...textTokens];
};

const AEROSPACE_SECTIONS: ShortcutSection[] = [
  {
    title: "Window Navigation",
    entries: [
      { binding: "ctrl-left", description: "Move focus left" },
      { binding: "ctrl-right", description: "Move focus right" },
      { binding: "ctrl-up", description: "Move focus up" },
      { binding: "ctrl-down", description: "Move focus down" },
      { binding: "ctrl-shift-left", description: "Swap window left" },
      { binding: "ctrl-shift-right", description: "Swap window right" },
      { binding: "ctrl-shift-up", description: "Swap window up" },
      { binding: "ctrl-shift-down", description: "Swap window down" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Jump to Workspace",
    entries: [
      { binding: "ctrl-1", description: "Jump to workspace 1" },
      { binding: "ctrl-2", description: "Jump to workspace 2" },
      { binding: "ctrl-3", description: "Jump to workspace 3" },
      { binding: "ctrl-4", description: "Jump to workspace 4" },
      { binding: "ctrl-5", description: "Jump to workspace 5" },
      { binding: "ctrl-6", description: "Jump to workspace 6" },
      { binding: "ctrl-7", description: "Jump to workspace 7" },
      { binding: "ctrl-8", description: "Jump to workspace 8" },
      { binding: "ctrl-9", description: "Jump to workspace 9" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Move Window to Workspace (Follow)",
    entries: [
      { binding: "ctrl-shift-1", description: "Move window to workspace 1 and follow" },
      { binding: "ctrl-shift-2", description: "Move window to workspace 2 and follow" },
      { binding: "ctrl-shift-3", description: "Move window to workspace 3 and follow" },
      { binding: "ctrl-shift-4", description: "Move window to workspace 4 and follow" },
      { binding: "ctrl-shift-5", description: "Move window to workspace 5 and follow" },
      { binding: "ctrl-shift-6", description: "Move window to workspace 6 and follow" },
      { binding: "ctrl-shift-7", description: "Move window to workspace 7 and follow" },
      { binding: "ctrl-shift-8", description: "Move window to workspace 8 and follow" },
      { binding: "ctrl-shift-9", description: "Move window to workspace 9 and follow" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Move Window to Workspace (No Follow)",
    entries: [
      { binding: "ctrl-shift-alt-1", description: "Move window to workspace 1 without following" },
      { binding: "ctrl-shift-alt-2", description: "Move window to workspace 2 without following" },
      { binding: "ctrl-shift-alt-3", description: "Move window to workspace 3 without following" },
      { binding: "ctrl-shift-alt-4", description: "Move window to workspace 4 without following" },
      { binding: "ctrl-shift-alt-5", description: "Move window to workspace 5 without following" },
      { binding: "ctrl-shift-alt-6", description: "Move window to workspace 6 without following" },
      { binding: "ctrl-shift-alt-7", description: "Move window to workspace 7 without following" },
      { binding: "ctrl-shift-alt-8", description: "Move window to workspace 8 without following" },
      { binding: "ctrl-shift-alt-9", description: "Move window to workspace 9 without following" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Workspace Cycling",
    entries: [
      { binding: "ctrl-tab", description: "Next workspace" },
      { binding: "ctrl-shift-tab", description: "Previous workspace" },
      { binding: "ctrl-alt-tab", description: "Switch to previous workspace (back-and-forth)" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Window Controls",
    entries: [
      { binding: "ctrl-t", description: "Toggle floating/tiling mode" },
      { binding: "ctrl-f", description: "Toggle fullscreen" },
      { binding: "ctrl-j", description: "Toggle split direction (horizontal/vertical)" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Resize Windows",
    entries: [
      { binding: "ctrl-equal", description: "Resize window +100" },
      { binding: "ctrl-minus", description: "Resize window -100" },
      { binding: "ctrl-shift-equal", description: "Resize window +50" },
      { binding: "ctrl-shift-minus", description: "Resize window -50" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Layout Management",
    entries: [
      { binding: "ctrl-alt-0", description: "Flatten workspace tree" },
      { binding: "ctrl-alt-shift-left", description: "Join window with left" },
      { binding: "ctrl-alt-shift-right", description: "Join window with right" },
      { binding: "ctrl-alt-shift-up", description: "Join window with up" },
      { binding: "ctrl-alt-shift-down", description: "Join window with down" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Monitor Controls",
    entries: [
      { binding: "ctrl-alt-cmd-left", description: "Move window to left monitor" },
      { binding: "ctrl-alt-cmd-right", description: "Move window to right monitor" },
      { binding: "ctrl-alt-cmd-up", description: "Move window to upper monitor" },
      { binding: "ctrl-alt-cmd-down", description: "Move window to lower monitor" },
      { binding: "ctrl-alt-1", description: "Move window to monitor 1" },
      { binding: "ctrl-alt-2", description: "Move window to monitor 2" },
      { binding: "ctrl-alt-3", description: "Move window to monitor 3" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Configuration",
    entries: [
      { binding: "alt-shift-h", description: "Switch to home setup" },
      { binding: "alt-shift-w", description: "Switch to work/office setup" },
      { binding: "alt-shift-l", description: "Switch to laptop-only setup" },
      { binding: "alt-shift-m", description: "Toggle sketchybar visibility" },
      { binding: "alt-shift-c", description: "Reload aerospace config" },
      { binding: "alt-shift-f", description: "Toggle macOS native fullscreen" },
    ],
  },
];

const RAYCAST_SECTIONS: ShortcutSection[] = [
];

const SECTIONS: ShortcutSection[] = [...AEROSPACE_SECTIONS];

export default function Command() {
  return (
    <List searchBarPlaceholder="Search keybindings...">
      {SECTIONS.map((section) => (
        <List.Section key={section.title} title={section.title}>
          {section.entries.map((entry) => (
            <List.Item
              key={`${entry.binding}-${entry.description}`}
              title={formatKeybinding(entry.binding)}
              subtitle={entry.description}
              keywords={keywords(section, entry)}
            />
          ))}
        </List.Section>
      ))}
    </List>
  );
}
