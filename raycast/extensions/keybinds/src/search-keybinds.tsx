import { List } from "@raycast/api";
import { useState } from "react";

type ShortcutEntry = {
  binding: string;
  description: string;
};

type ShortcutSection = {
  title: string;
  platform?: string;
  entries: ShortcutEntry[];
};

const ARROWS: Record<string, string> = {
  left: "←",
  right: "→",
  up: "↑",
  down: "↓",
};

const KEY_LABELS: Record<string, string> = {
  alt: "OPT",
  option: "OPT",
  opt: "OPT",
  cmd: "CMD",
  command: "CMD",
  caps: "CAPS",
};

const formatKeybinding = (binding: string) => {
  const tokens: string[] = [];

  binding
    .trim()
    .split(/\s+/)
    .forEach((chunk) => {
      chunk.split("-").forEach((segment) => {
        if (!segment) {
          return;
        }

        if (segment.includes("+") && !segment.startsWith(":") && !segment.startsWith('"')) {
          segment.split("+").forEach((part) => {
            if (part) {
              tokens.push(part);
            }
          });
        } else {
          tokens.push(segment);
        }
      });
    });

  const normalizedTokens = tokens.map((part) => part.toLowerCase());
  const hasCtrl = normalizedTokens.some((token) => token === "ctrl" || token === "control");
  const hasAlt = normalizedTokens.some((token) => token === "alt" || token === "option" || token === "opt");
  const hasCmd = normalizedTokens.some((token) => token === "cmd" || token === "command");
  const collapseToCaps = hasCtrl && hasAlt && hasCmd;

  const formattedTokens: string[] = [];
  let capsInserted = false;

  tokens.forEach((part) => {
    const normalized = part.toLowerCase();
    if (
      collapseToCaps &&
      (normalized === "ctrl" ||
        normalized === "control" ||
        normalized === "alt" ||
        normalized === "option" ||
        normalized === "opt" ||
        normalized === "cmd" ||
        normalized === "command")
    ) {
      if (!capsInserted) {
        formattedTokens.push("CAPS");
        capsInserted = true;
      }
      return;
    }

    formattedTokens.push(ARROWS[normalized] ?? KEY_LABELS[normalized] ?? part.toUpperCase());
  });

  return formattedTokens.join(" + ");
};

const keywords = (section: ShortcutSection, entry: ShortcutEntry) => {
  const textTokens = entry.description
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter(Boolean);
  const sectionTokens = section.title
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter(Boolean);

  return [
    entry.description,
    section.title,
    entry.binding,
    entry.binding.replace(/-/g, " "),
    ...textTokens,
    ...sectionTokens,
  ];
};

const AEROSPACE_SECTIONS: ShortcutSection[] = [
  {
    platform: "Aerospace",
    title: "Aerospace - Window Navigation",
    entries: [
      { binding: "ctrl-alt-cmd-left", description: "Move focus left" },
      { binding: "ctrl-alt-cmd-right", description: "Move focus right" },
      { binding: "ctrl-alt-cmd-up", description: "Move focus up" },
      { binding: "ctrl-alt-cmd-down", description: "Move focus down" },
      { binding: "ctrl-alt-cmd-shift-left", description: "Swap window left (wraps to prev monitor)" },
      { binding: "ctrl-alt-cmd-shift-right", description: "Swap window right (wraps to next monitor)" },
      { binding: "ctrl-alt-cmd-shift-up", description: "Swap window up (wraps to upper monitor)" },
      { binding: "ctrl-alt-cmd-shift-down", description: "Swap window down (wraps to lower monitor)" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Aerospace - Jump to Workspace",
    entries: [
      { binding: "ctrl-alt-cmd-1", description: "Jump to workspace 1" },
      { binding: "ctrl-alt-cmd-2", description: "Jump to workspace 2" },
      { binding: "ctrl-alt-cmd-3", description: "Jump to workspace 3" },
      { binding: "ctrl-alt-cmd-4", description: "Jump to workspace 4" },
      { binding: "ctrl-alt-cmd-5", description: "Jump to workspace 5" },
      { binding: "ctrl-alt-cmd-6", description: "Jump to workspace 6" },
      { binding: "ctrl-alt-cmd-7", description: "Jump to workspace 7" },
      { binding: "ctrl-alt-cmd-8", description: "Jump to workspace 8" },
      { binding: "ctrl-alt-cmd-9", description: "Jump to workspace 9" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Aerospace - Move Window to Workspace (Follow)",
    entries: [
      { binding: "ctrl-alt-cmd-shift-1", description: "Move window to workspace 1 and follow" },
      { binding: "ctrl-alt-cmd-shift-2", description: "Move window to workspace 2 and follow" },
      { binding: "ctrl-alt-cmd-shift-3", description: "Move window to workspace 3 and follow" },
      { binding: "ctrl-alt-cmd-shift-4", description: "Move window to workspace 4 and follow" },
      { binding: "ctrl-alt-cmd-shift-5", description: "Move window to workspace 5 and follow" },
      { binding: "ctrl-alt-cmd-shift-6", description: "Move window to workspace 6 and follow" },
      { binding: "ctrl-alt-cmd-shift-7", description: "Move window to workspace 7 and follow" },
      { binding: "ctrl-alt-cmd-shift-8", description: "Move window to workspace 8 and follow" },
      { binding: "ctrl-alt-cmd-shift-9", description: "Move window to workspace 9 and follow" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Aerospace - Workspace Cycling",
    entries: [
      { binding: "ctrl-alt-cmd-tab", description: "Next workspace" },
      { binding: "ctrl-alt-cmd-shift-tab", description: "Previous workspace" },
      { binding: "ctrl-alt-tab", description: "Switch to previous workspace (back-and-forth)" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Aerospace - Window Controls",
    entries: [
      { binding: "ctrl-alt-cmd-t", description: "Toggle floating/tiling mode" },
      { binding: "ctrl-alt-cmd-f", description: "Toggle fullscreen" },
      { binding: "ctrl-alt-cmd-shift-j", description: "Toggle split direction (horizontal/vertical)" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Aerospace - Resize Windows",
    entries: [
      { binding: "ctrl-alt-cmd-equal", description: "Resize window +100" },
      { binding: "ctrl-alt-cmd-minus", description: "Resize window -100" },
      { binding: "ctrl-alt-cmd-shift-equal", description: "Resize window +50" },
      { binding: "ctrl-alt-cmd-shift-minus", description: "Resize window -50" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Aerospace - Layout Management",
    entries: [
      { binding: "ctrl-alt-cmd-shift-0", description: "Flatten workspace tree" },
      { binding: "ctrl-alt-left", description: "Join window with left" },
      { binding: "ctrl-alt-right", description: "Join window with right" },
      { binding: "ctrl-alt-up", description: "Join window with up" },
      { binding: "ctrl-alt-down", description: "Join window with down" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Aerospace - Monitor Controls",
    entries: [
      { binding: "ctrl-alt-shift-left", description: "Move window to left monitor" },
      { binding: "ctrl-alt-shift-right", description: "Move window to right monitor" },
      { binding: "ctrl-alt-shift-up", description: "Move window to upper monitor" },
      { binding: "ctrl-alt-shift-down", description: "Move window to lower monitor" },
      { binding: "ctrl-alt-shift-1", description: "Move window to monitor 1" },
      { binding: "ctrl-alt-shift-2", description: "Move window to monitor 2" },
      { binding: "ctrl-alt-shift-3", description: "Move window to monitor 3" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Aerospace - Configuration",
    entries: [
      { binding: "alt-shift-h", description: "Switch to home setup" },
      { binding: "alt-shift-w", description: "Switch to work/office setup" },
      { binding: "alt-shift-l", description: "Switch to laptop-only setup" },
      { binding: "alt-shift-m", description: "Toggle sketchybar visibility" },
      { binding: "alt-shift-a", description: "Toggle AutoRaise on/off" },
      { binding: "alt-shift-c", description: "Reload aerospace config" },
      { binding: "alt-shift-f", description: "Toggle macOS native fullscreen" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Aerospace - Window Management (Float Mode)",
    entries: [
      { binding: "ctrl-alt-shift-\\", description: "Almost Maximize" },
      { binding: "ctrl-alt-shift-equal", description: "Make Larger" },
      { binding: "ctrl-alt-shift-minus", description: "Make Smaller" },
      { binding: "ctrl-alt-shift-v", description: "Reasonable Size" },
    ],
  },
];

const SCREENSHOT_SECTIONS: ShortcutSection[] = [
  {
    platform: "macOS",
    title: "Screenshots - Screenshots & Recording",
    entries: [
      { binding: "ctrl-shift-cmd-3", description: "Save picture of screen as a file" },
      { binding: "shift-cmd-3", description: "Copy picture of screen to the clipboard" },
      { binding: "ctrl-shift-cmd-4", description: "Save picture of selected area as a file" },
      { binding: "shift-cmd-4", description: "Copy picture of selected area to the clipboard" },
      { binding: "shift-cmd-5", description: "Screenshot and recording options (screenshot HUD)" },
    ],
  },
];

const APPLICATION_SECTIONS: ShortcutSection[] = [
  {
    platform: "Applications",
    title: "Applications - Application Shortcuts",
    entries: [
      { binding: "ctrl-alt-cmd-shift-a", description: "Alarm.com" },
      { binding: "ctrl-alt-cmd-b", description: "Brave Browser" },
      { binding: "ctrl-alt-cmd-shift-c", description: "Calendar" },
      { binding: "ctrl-alt-cmd-c", description: "ChatGPT" },
      { binding: "ctrl-alt-cmd-a", description: "Claude" },
      { binding: "ctrl-alt-cmd-d", description: "Discord" },
      { binding: "ctrl-alt-cmd-shift-f", description: "Finder" },
      { binding: "ctrl-alt-cmd-enter", description: "Ghostty" },
      { binding: "ctrl-alt-cmd-x", description: "Grok" },
      { binding: "ctrl-alt-cmd-shift-m", description: "Mail" },
      { binding: "ctrl-alt-cmd-m", description: "Messages" },
      { binding: "ctrl-alt-cmd-e", description: "Microsoft Excel" },
      { binding: "ctrl-alt-cmd-o", description: "Microsoft Outlook" },
      { binding: "ctrl-alt-cmd-shift-t", description: "Microsoft Teams" },
      { binding: "ctrl-alt-cmd-n", description: "Obsidian" },
      { binding: "ctrl-alt-cmd-p", description: "Perplexity" },
      { binding: "ctrl-alt-cmd-r", description: "Reminders" },
      { binding: "ctrl-alt-cmd-s", description: "Safari" },
      { binding: "ctrl-alt-cmd-shift-s", description: "Spotify" },
      { binding: "ctrl-alt-cmd-shift-v", description: "Visual Studio Code" },
      { binding: "ctrl-alt-cmd-y", description: "YouTube" },
      { binding: "ctrl-alt-cmd-shift-p", description: "iPhone Mirroring" },
    ],
  },
  {
    platform: "Applications",
    title: "Applications - Commands",
    entries: [
      { binding: "ctrl-alt-cmd-v", description: "Clipboard History" },
      { binding: "ctrl-alt-cmd-`", description: "Confetti" },
      { binding: "shift-cmd-l", description: "Autofill last used login (Bitwarden/Brave)" },
      { binding: "ctrl-alt-cmd-shift-z", description: "AI Chat" },
      { binding: "ctrl-alt-cmd-space", description: "Search Emoji & Symbols" },
      { binding: "alt-f", description: "Search Files" },
      { binding: "ctrl-alt-cmd-k", description: "Search Keybinds" },
    ],
  },
  {
    platform: "Microsoft Teams",
    title: "Microsoft Teams - Navigation & Compose",
    entries: [
      { binding: "cmd-.", description: "Show keyboard shortcuts" },
      { binding: "cmd-l", description: "Move focus to chat/channel list" },
      { binding: "cmd-p", description: "Move focus to message pane" },
      { binding: "cmd-r", description: "Go to compose box" },
    ],
  },
];

const SECTIONS: ShortcutSection[] = [
  ...AEROSPACE_SECTIONS,
  ...SCREENSHOT_SECTIONS,
  {
    platform: "Neovim",
    title: "Neovim - Navigation",
    entries: [
      { binding: "space", description: "Show command options" },
      { binding: "space space", description: "Open file via fuzzy search" },
      { binding: "space e", description: "Toggle sidebar" },
      { binding: "space g g", description: "Show git controls" },
      { binding: "space s g", description: "Search file content" },
      { binding: "space b d", description: "Close file tab" },
      { binding: "shift-h", description: "Go to left file tab" },
      { binding: "shift-l", description: "Go to right file tab" },
      { binding: "ctrl-w w", description: "Jump between sidebar and editor" },
      { binding: "ctrl-h", description: "Move focus left" },
      { binding: "ctrl-j", description: "Move focus down" },
      { binding: "ctrl-k", description: "Move focus up" },
      { binding: "ctrl-l", description: "Move focus right" },
      { binding: "h", description: "Move cursor left" },
      { binding: "j", description: "Move cursor down" },
      { binding: "k", description: "Move cursor up" },
      { binding: "l", description: "Move cursor right" },
      { binding: "w", description: "Jump to next word start" },
      { binding: "b", description: "Jump back to word start" },
      { binding: "e", description: "Jump to end of word" },
      { binding: "0", description: "Jump to start of line" },
      { binding: "$", description: "Jump to end of line" },
      { binding: "gg", description: "Jump to top of file" },
      { binding: "G", description: "Jump to bottom of file" },
      { binding: "ctrl-u", description: "Scroll half page up" },
      { binding: "ctrl-d", description: "Scroll half page down" },
      { binding: "%", description: "Jump to matching bracket" },
      { binding: "f+char", description: "Find character forward on line" },
      { binding: "F+char", description: "Find character backward on line" },
      { binding: "*", description: "Search word under cursor" },
      { binding: "zz", description: "Center cursor line on screen" },
    ],
  },
  {
    platform: "Neovim",
    title: "Neovim - While in Sidebar",
    entries: [
      { binding: "a", description: "Add new file in parent dir" },
      { binding: "shift-a", description: "Add new subdir in parent dir" },
      { binding: "d", description: "Delete highlighted file/dir" },
      { binding: "m", description: "Move highlighted file/dir" },
      { binding: "r", description: "Rename highlighted file/dir" },
      { binding: "?", description: "Show help for all commands" },
    ],
  },
  {
    platform: "Neovim",
    title: "Neovim - Modes & Editing",
    entries: [
      { binding: "i", description: "Enter insert mode before cursor" },
      { binding: "a", description: "Enter insert mode after cursor" },
      { binding: "o", description: "Insert new line below and enter insert mode" },
      { binding: "O", description: "Insert new line above and enter insert mode" },
      { binding: "esc", description: "Return to normal mode" },
      { binding: "v", description: "Enter visual mode (character select)" },
      { binding: "V", description: "Enter visual line mode" },
      { binding: "ctrl-v", description: "Enter visual block mode" },
      { binding: "dd", description: "Delete line" },
      { binding: "dw", description: "Delete word" },
      { binding: "d$", description: "Delete to end of line" },
      { binding: "cc", description: "Change line (delete and enter insert mode)" },
      { binding: "cw", description: "Change word (delete word and enter insert mode)" },
      { binding: "x", description: "Delete character under cursor" },
      { binding: "J", description: "Join line below to current line" },
      { binding: ">>", description: "Indent line right" },
      { binding: "<<", description: "Indent line left" },
      { binding: ".", description: "Repeat last change" },
      { binding: "u", description: "Undo" },
      { binding: "ctrl-r", description: "Redo" },
    ],
  },
  {
    platform: "Neovim",
    title: "Neovim - Windows & Splits",
    entries: [
      { binding: "ctrl-w s", description: "Split window horizontally" },
      { binding: "ctrl-w v", description: "Split window vertically" },
      { binding: "ctrl-w h", description: "Navigate to left window" },
      { binding: "ctrl-w j", description: "Navigate to window below" },
      { binding: "ctrl-w k", description: "Navigate to window above" },
      { binding: "ctrl-w l", description: "Navigate to right window" },
      { binding: "ctrl-w q", description: "Close current window" },
      { binding: "ctrl-w o", description: "Close all other windows" },
      { binding: "ctrl-w =", description: "Equalize window sizes" },
      { binding: "ctrl-left", description: "Decrease window width" },
      { binding: "ctrl-right", description: "Increase window width" },
      { binding: "ctrl-down", description: "Decrease window height" },
      { binding: "ctrl-up", description: "Increase window height" },
    ],
  },
  {
    platform: "Neovim",
    title: "Neovim - Clipboard & Search",
    entries: [
      { binding: "yy", description: "Yank (copy) line" },
      { binding: "yw", description: "Yank (copy) word" },
      { binding: "y$", description: "Yank (copy) to end of line" },
      { binding: "p", description: "Paste after cursor" },
      { binding: "P", description: "Paste before cursor" },
      { binding: '"+y', description: "Yank to system clipboard (visual mode)" },
      { binding: ":%y+", description: "Yank entire file to system clipboard" },
      { binding: "/", description: "Search forward (open search prompt)" },
      { binding: "?", description: "Search backward (open search prompt)" },
      { binding: "n", description: "Jump to next search result" },
      { binding: "N", description: "Jump to previous search result" },
      { binding: ":w", description: "Save file" },
      { binding: ":q", description: "Quit" },
      { binding: ":wq", description: "Save and quit" },
      { binding: ":q!", description: "Quit without saving" },
      { binding: ":e", description: "Open file (edit)" },
    ],
  },
  ...APPLICATION_SECTIONS,
];


export default function Command() {
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState<string>("");

  const platformFilteredSections =
    platformFilter === "all" ? SECTIONS : SECTIONS.filter((section) => section.platform === platformFilter);

  const normalizedQuery = searchText.trim().toLowerCase();

  const filteredSections =
    normalizedQuery.length === 0
      ? platformFilteredSections
      : platformFilteredSections
          .map((section) => {
            const sectionMatches = section.title.toLowerCase().includes(normalizedQuery);
            if (sectionMatches) {
              return section;
            }

            const matchingEntries = section.entries.filter((entry) => {
              const entryKeywords = keywords(section, entry).map((keyword) => keyword.toLowerCase());
              return entryKeywords.some((keyword) => keyword.includes(normalizedQuery));
            });

            return matchingEntries.length > 0 ? { ...section, entries: matchingEntries } : null;
          })
          .filter((section): section is ShortcutSection => Boolean(section));

  return (
    <List
      searchBarPlaceholder="Search keybindings..."
      onSearchTextChange={setSearchText}
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by Platform" value={platformFilter} onChange={setPlatformFilter}>
          <List.Dropdown.Item title="All" value="all" />
          <List.Dropdown.Item title="Aerospace" value="Aerospace" />
          <List.Dropdown.Item title="Neovim" value="Neovim" />
          <List.Dropdown.Item title="Screenshots" value="macOS" />
          <List.Dropdown.Item title="Applications" value="Applications" />
          <List.Dropdown.Item title="Microsoft Teams" value="Microsoft Teams" />
        </List.Dropdown>
      }
    >
      {filteredSections.map((section) => (
        <List.Section
          key={section.title}
          title={section.title.includes(" - ") ? section.title.split(" - ")[0] : section.title}
          subtitle={section.title.includes(" - ") ? section.title.split(" - ")[1] : undefined}
        >
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
