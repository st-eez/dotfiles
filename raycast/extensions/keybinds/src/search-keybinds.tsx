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

type ScoredEntry = {
  section: ShortcutSection;
  entry: ShortcutEntry;
  score: number;
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

  const formattedTokens = tokens.map((part) => {
    const normalized = part.toLowerCase();
    return ARROWS[normalized] ?? KEY_LABELS[normalized] ?? part.toUpperCase();
  });

  return formattedTokens.join(" + ");
};

const normalizeModifier = (token: string): string[] => {
  const lower = token.toLowerCase();
  if (lower === "alt" || lower === "option" || lower === "opt") {
    return ["alt", "option", "opt"];
  }
  if (lower === "cmd" || lower === "command") {
    return ["cmd", "command"];
  }
  if (lower === "ctrl" || lower === "control") {
    return ["ctrl", "control"];
  }
  if (lower === "caps" || lower === "capslock" || lower === "hyper") {
    return ["caps", "capslock", "hyper"];
  }
  return [lower];
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

  const formattedBinding = formatKeybinding(entry.binding);
  const formattedTokens = formattedBinding
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter(Boolean);

  const formattedWithoutPlus = formattedBinding.replace(/\s*\+\s*/g, " ").trim();

  const bindingParts = entry.binding
    .toLowerCase()
    .split(/[-+\s]+/)
    .filter(Boolean);
  const normalizedBindingParts = bindingParts.flatMap(normalizeModifier);

  return [
    entry.description,
    section.title,
    entry.binding,
    entry.binding.replace(/-/g, " "),
    formattedBinding,
    formattedWithoutPlus,
    ...textTokens,
    ...sectionTokens,
    ...formattedTokens,
    ...normalizedBindingParts,
  ];
};

const scoreMatch = (section: ShortcutSection, entry: ShortcutEntry, searchTokens: string[]): number => {
  if (searchTokens.length === 0) {
    return 1;
  }

  const formattedBinding = formatKeybinding(entry.binding).toLowerCase();
  const formattedBindingNoPlus = formattedBinding.replace(/\s*\+\s*/g, " ").trim();
  const bindingTokens = formattedBindingNoPlus.split(/\s+/);

  const normalizedBinding = entry.binding.toLowerCase();
  const bindingParts = normalizedBinding.split(/[-+\s]+/).filter(Boolean);
  const expandedBindingParts = bindingParts.flatMap(normalizeModifier);

  const descriptionLower = entry.description.toLowerCase();
  const titleLower = section.title.toLowerCase();

  const searchString = searchTokens.join(" ");

  // Score 100: Exact match with formatted binding (e.g., "cmd t" matches "CMD + T" exactly)
  if (formattedBindingNoPlus === searchString) {
    return 100;
  }

  // Score 90: Exact match with raw binding (e.g., "cmd-t" matches binding "cmd-t")
  if (normalizedBinding === searchString || normalizedBinding === searchTokens.join("-")) {
    return 90;
  }

  // Score 80: All search tokens match binding tokens exactly in order
  let allTokensMatchBinding = true;
  let tokenIndex = 0;
  for (const searchToken of searchTokens) {
    let foundMatch = false;
    while (tokenIndex < bindingTokens.length) {
      const bindingToken = bindingTokens[tokenIndex];
      const expandedToken = normalizeModifier(bindingToken);
      if (expandedToken.some((t) => t.startsWith(searchToken) || searchToken.startsWith(t))) {
        foundMatch = true;
        tokenIndex++;
        break;
      }
      tokenIndex++;
    }
    if (!foundMatch) {
      allTokensMatchBinding = false;
      break;
    }
  }
  if (allTokensMatchBinding && searchTokens.length === bindingTokens.length) {
    return 80;
  }

  // Score 70: All search tokens found in binding parts (any order)
  const allInBinding = searchTokens.every((token) =>
    expandedBindingParts.some((part) => part.startsWith(token) || token.startsWith(part)),
  );
  if (allInBinding) {
    return 70;
  }

  // Score 50: All search tokens found in binding + description combined
  const allInBindingOrDescription = searchTokens.every((token) => {
    const inBinding = expandedBindingParts.some((part) => part.startsWith(token) || token.startsWith(part));
    const inDescription = descriptionLower.includes(token);
    return inBinding || inDescription;
  });
  if (allInBindingOrDescription) {
    return 50;
  }

  // Score 30: All search tokens found in description only
  const allInDescription = searchTokens.every((token) => descriptionLower.includes(token));
  if (allInDescription) {
    return 30;
  }

  // Score 20: All search tokens found in section title
  const allInTitle = searchTokens.every((token) => titleLower.includes(token));
  if (allInTitle) {
    return 20;
  }

  // Score 10: Partial matches via keywords (fallback)
  const entryKeywords = keywords(section, entry).map((k) => k.toLowerCase());
  const allInKeywords = searchTokens.every((token) =>
    entryKeywords.some((keyword) => {
      const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escapedToken}`, "i");
      return regex.test(keyword);
    }),
  );
  if (allInKeywords) {
    return 10;
  }

  // Score 0: No match
  return 0;
};

const AEROSPACE_SECTIONS: ShortcutSection[] = [
  {
    platform: "Aerospace",
    title: "Aerospace - Window Navigation",
    entries: [
      { binding: "alt-left", description: "Move focus left" },
      { binding: "alt-right", description: "Move focus right" },
      { binding: "alt-up", description: "Move focus up" },
      { binding: "alt-down", description: "Move focus down" },
      { binding: "alt-h", description: "Move focus left" },
      { binding: "alt-l", description: "Move focus right" },
      { binding: "alt-k", description: "Move focus up" },
      { binding: "alt-j", description: "Move focus down" },
      { binding: "alt-shift-left", description: "Swap window left (wraps to prev monitor)" },
      { binding: "alt-shift-right", description: "Swap window right (wraps to next monitor)" },
      { binding: "alt-shift-up", description: "Swap window up (wraps to upper monitor)" },
      { binding: "alt-shift-down", description: "Swap window down (wraps to lower monitor)" },
      { binding: "alt-shift-h", description: "Swap window left (wraps to prev monitor)" },
      { binding: "alt-shift-l", description: "Swap window right (wraps to next monitor)" },
      { binding: "alt-shift-k", description: "Swap window up (wraps to upper monitor)" },
      { binding: "alt-shift-j", description: "Swap window down (wraps to lower monitor)" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Aerospace - Jump to Workspace",
    entries: [
      { binding: "alt-1", description: "Jump to workspace 1" },
      { binding: "alt-2", description: "Jump to workspace 2" },
      { binding: "alt-3", description: "Jump to workspace 3" },
      { binding: "alt-4", description: "Jump to workspace 4" },
      { binding: "alt-5", description: "Jump to workspace 5" },
      { binding: "alt-6", description: "Jump to workspace 6" },
      { binding: "alt-7", description: "Jump to workspace 7" },
      { binding: "alt-8", description: "Jump to workspace 8" },
      { binding: "alt-9", description: "Jump to workspace 9" },
      { binding: "alt-0", description: "Jump to workspace 0" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Aerospace - Move Window to Workspace (Follow)",
    entries: [
      { binding: "alt-shift-1", description: "Move window to workspace 1 and follow" },
      { binding: "alt-shift-2", description: "Move window to workspace 2 and follow" },
      { binding: "alt-shift-3", description: "Move window to workspace 3 and follow" },
      { binding: "alt-shift-4", description: "Move window to workspace 4 and follow" },
      { binding: "alt-shift-5", description: "Move window to workspace 5 and follow" },
      { binding: "alt-shift-6", description: "Move window to workspace 6 and follow" },
      { binding: "alt-shift-7", description: "Move window to workspace 7 and follow" },
      { binding: "alt-shift-8", description: "Move window to workspace 8 and follow" },
      { binding: "alt-shift-9", description: "Move window to workspace 9 and follow" },
      { binding: "alt-shift-0", description: "Move window to workspace 0 and follow" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Aerospace - Workspace Cycling",
    entries: [
      { binding: "alt-tab", description: "Next workspace" },
      { binding: "alt-shift-tab", description: "Previous workspace" },
      { binding: "ctrl-alt-tab", description: "Switch to previous workspace (back-and-forth)" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Aerospace - Window Controls",
    entries: [
      { binding: "alt-t", description: "Toggle floating/tiling mode" },
      { binding: "alt-f", description: "Toggle fullscreen" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Aerospace - Resize Windows",
    entries: [
      { binding: "alt-equal", description: "Resize window +100" },
      { binding: "alt-minus", description: "Resize window -100" },
      { binding: "alt-shift-equal", description: "Resize window +50" },
      { binding: "alt-shift-minus", description: "Resize window -50" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Aerospace - Layout Management",
    entries: [
      { binding: "ctrl-alt-left", description: "Join window with left" },
      { binding: "ctrl-alt-right", description: "Join window with right" },
      { binding: "ctrl-alt-up", description: "Join window with up" },
      { binding: "ctrl-alt-down", description: "Join window with down" },
    ],
  },
  {
    platform: "Aerospace",
    title: "Aerospace - Monitor & Workspace Controls",
    entries: [
      { binding: "ctrl-alt-shift-left", description: "Move window to previous workspace on current monitor" },
      { binding: "ctrl-alt-shift-right", description: "Move window to next workspace on current monitor" },
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
      { binding: "ctrl-alt-r", description: "Flatten workspace tree (reset layout)" },
      { binding: "ctrl-alt-h", description: "Switch to home setup" },
      { binding: "ctrl-alt-w", description: "Switch to work/office setup" },
      { binding: "ctrl-alt-l", description: "Switch to laptop-only setup" },
      { binding: "ctrl-alt-m", description: "Toggle sketchybar visibility" },
      { binding: "ctrl-alt-a", description: "Toggle AutoRaise on/off" },
      { binding: "ctrl-alt-c", description: "Reload aerospace config" },
      { binding: "ctrl-alt-shift-f", description: "Toggle macOS native fullscreen" },
      { binding: "ctrl-alt-j", description: "Toggle split direction (horizontal/vertical)" },
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

const KEYBOARD_SECTIONS: ShortcutSection[] = [
  {
    platform: "macOS",
    title: "macOS - Modifier Keys",
    entries: [{ binding: "caps", description: "Tap: Escape; Hold: Option (Hyper)" }],
  },
];

const GHOSTTY_SECTIONS: ShortcutSection[] = [
  {
    platform: "Ghostty",
    title: "Ghostty - Tab Management",
    entries: [
      { binding: "cmd-t", description: "New tab" },
      { binding: "cmd-w", description: "Close surface" },
      { binding: "cmd-alt-w", description: "Close tab" },
      { binding: "cmd-alt-shift-w", description: "Close all windows" },
      { binding: "shift-cmd-w", description: "Close window" },
      { binding: "cmd-1", description: "Go to tab 1" },
      { binding: "cmd-2", description: "Go to tab 2" },
      { binding: "cmd-3", description: "Go to tab 3" },
      { binding: "cmd-4", description: "Go to tab 4" },
      { binding: "cmd-5", description: "Go to tab 5" },
      { binding: "cmd-6", description: "Go to tab 6" },
      { binding: "cmd-7", description: "Go to tab 7" },
      { binding: "cmd-8", description: "Go to tab 8" },
      { binding: "cmd-9", description: "Last tab" },
      { binding: "shift-cmd-[", description: "Previous tab" },
      { binding: "shift-cmd-]", description: "Next tab" },
      { binding: "ctrl-tab", description: "Next tab (cycle)" },
      { binding: "ctrl-shift-tab", description: "Previous tab (cycle)" },
      { binding: "shift-cmd-t", description: "Undo close tab" },
      { binding: "shift-cmd-z", description: "Redo close tab" },
      { binding: "cmd-z", description: "Undo close tab" },
    ],
  },
  {
    platform: "Ghostty",
    title: "Ghostty - Split Management",
    entries: [
      { binding: "cmd-d", description: "New split (right)" },
      { binding: "shift-cmd-d", description: "New split (down)" },
      { binding: "cmd-alt-down", description: "Go to split down" },
      { binding: "cmd-alt-up", description: "Go to split up" },
      { binding: "cmd-alt-left", description: "Go to split left" },
      { binding: "cmd-alt-right", description: "Go to split right" },
      { binding: "cmd-[", description: "Go to previous split" },
      { binding: "cmd-]", description: "Go to next split" },
      { binding: "ctrl-cmd-down", description: "Resize split down by 10" },
      { binding: "ctrl-cmd-up", description: "Resize split up by 10" },
      { binding: "ctrl-cmd-left", description: "Resize split left by 10" },
      { binding: "ctrl-cmd-right", description: "Resize split right by 10" },
      { binding: "ctrl-cmd-equal", description: "Equalize splits" },
      { binding: "shift-cmd-enter", description: "Toggle split zoom" },
    ],
  },
  {
    platform: "Ghostty",
    title: "Ghostty - Window Management",
    entries: [
      { binding: "cmd-n", description: "New window" },
      { binding: "cmd-q", description: "Quit Ghostty" },
      { binding: "cmd-enter", description: "Toggle fullscreen" },
      { binding: "ctrl-cmd-f", description: "Toggle fullscreen" },
    ],
  },
  {
    platform: "Ghostty",
    title: "Ghostty - Navigation & Scrolling",
    entries: [
      { binding: "cmd-down", description: "Jump to next prompt" },
      { binding: "cmd-up", description: "Jump to previous prompt" },
      { binding: "shift-cmd-down", description: "Jump to next prompt" },
      { binding: "shift-cmd-up", description: "Jump to previous prompt" },
      { binding: "cmd-home", description: "Scroll to top" },
      { binding: "cmd-end", description: "Scroll to bottom" },
      { binding: "cmd-page_up", description: "Scroll page up" },
      { binding: "cmd-page_down", description: "Scroll page down" },
    ],
  },
  {
    platform: "Ghostty",
    title: "Ghostty - Text Selection & Clipboard",
    entries: [
      { binding: "cmd-c", description: "Copy to clipboard" },
      { binding: "cmd-v", description: "Paste from clipboard" },
      { binding: "shift-cmd-v", description: "Paste from selection" },
      { binding: "cmd-a", description: "Select all" },
      { binding: "shift-down", description: "Adjust selection down" },
      { binding: "shift-up", description: "Adjust selection up" },
      { binding: "shift-left", description: "Adjust selection left" },
      { binding: "shift-right", description: "Adjust selection right" },
      { binding: "shift-home", description: "Adjust selection to home" },
      { binding: "shift-end", description: "Adjust selection to end" },
      { binding: "shift-page_up", description: "Adjust selection page up" },
      { binding: "shift-page_down", description: "Adjust selection page down" },
      { binding: "copy", description: "Copy to clipboard (key)" },
      { binding: "paste", description: "Paste from clipboard (key)" },
    ],
  },
  {
    platform: "Ghostty",
    title: "Ghostty - Screen File Operations",
    entries: [
      { binding: "cmd-alt-shift-j", description: "Write screen file and open" },
      { binding: "ctrl-cmd-shift-j", description: "Write screen file and copy path" },
      { binding: "shift-cmd-j", description: "Paste screen file path" },
    ],
  },
  {
    platform: "Ghostty",
    title: "Ghostty - Font & Display",
    entries: [
      { binding: "cmd-equal", description: "Increase font size by 1" },
      { binding: "cmd-+", description: "Increase font size by 1" },
      { binding: "cmd-minus", description: "Decrease font size by 1" },
      { binding: "cmd-0", description: "Reset font size" },
    ],
  },
  {
    platform: "Ghostty",
    title: "Ghostty - Configuration & Tools",
    entries: [
      { binding: "shift-cmd-,", description: "Reload config" },
      { binding: "cmd-,", description: "Open config file" },
      { binding: "cmd-alt-i", description: "Toggle inspector" },
      { binding: "shift-cmd-p", description: "Toggle command palette" },
      { binding: "cmd-k", description: "Clear screen" },
    ],
  },
  {
    platform: "Ghostty",
    title: "Ghostty - Terminal Text Navigation",
    entries: [
      { binding: "cmd-left", description: "Jump to line start (Ctrl+A)" },
      { binding: "cmd-right", description: "Jump to line end (Ctrl+E)" },
      { binding: "alt-left", description: "Jump backward one word (Esc+B)" },
      { binding: "alt-right", description: "Jump forward one word (Esc+F)" },
      { binding: "cmd-backspace", description: "Delete to line start (Ctrl+U)" },
    ],
  },
];

const APPLICATION_SECTIONS: ShortcutSection[] = [
  {
    platform: "Applications",
    title: "Applications - Application Shortcuts",
    entries: [
      { binding: "alt-shift-a", description: "Alarm.com" },
      { binding: "alt-v", description: "Antigravity" },
      { binding: "alt-shift-b", description: "Brave Browser" },
      { binding: "alt-shift-c", description: "Calendar" },
      { binding: "alt-c", description: "ChatGPT" },
      { binding: "alt-a", description: "Claude" },
      { binding: "alt-d", description: "Discord" },
      { binding: "alt-shift-f", description: "Finder" },
      { binding: "alt-enter", description: "Ghostty" },
      { binding: "alt-g", description: "Google Chrome" },
      { binding: "alt-x", description: "Grok" },
      { binding: "alt-b", description: "Helium" },
      { binding: "alt-shift-m", description: "Mail" },
      { binding: "alt-m", description: "Messages" },
      { binding: "alt-e", description: "Microsoft Excel" },
      { binding: "alt-o", description: "Microsoft Outlook" },
      { binding: "alt-shift-t", description: "Microsoft Teams" },
      { binding: "alt-n", description: "Notes Raycast" },
      { binding: "alt-shift-n", description: "Obsidian" },
      { binding: "alt-p", description: "Perplexity" },
      { binding: "alt-r", description: "Reminders" },
      { binding: "alt-s", description: "Safari" },
      { binding: "alt-shift-s", description: "Spotify" },
      { binding: "alt-shift-v", description: "Visual Studio Code" },
      { binding: "alt-y", description: "YouTube" },
      { binding: "alt-shift-p", description: "iPhone Mirroring" },
    ],
  },
  {
    platform: "Applications",
    title: "Applications - Commands",
    entries: [
      { binding: "opt-v", description: "Clipboard History" },
      { binding: "alt-`", description: "Confetti" },
      { binding: "shift-cmd-l", description: "Autofill last used login (Bitwarden/Brave)" },
      { binding: "alt-shift-z", description: "AI Chat" },
      { binding: "alt-space", description: "Search Emoji & Symbols" },
      { binding: "alt-f", description: "Search Files" },
      { binding: "alt-k", description: "Search Keybinds" },
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
  ...APPLICATION_SECTIONS,
  ...AEROSPACE_SECTIONS,
  ...GHOSTTY_SECTIONS,
  ...KEYBOARD_SECTIONS,
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
  ...SCREENSHOT_SECTIONS,
];

export default function Command() {
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState<string>("");

  const platformFilteredSections =
    platformFilter === "all" ? SECTIONS : SECTIONS.filter((section) => section.platform === platformFilter);

  const normalizedQuery = searchText.trim().toLowerCase();
  const searchTokens = normalizedQuery.split(/\s+/).filter((t) => t && t !== "+");

  let filteredSections: ShortcutSection[];

  if (searchTokens.length === 0) {
    filteredSections = platformFilteredSections;
  } else {
    // Score all entries
    const scoredEntries: ScoredEntry[] = [];

    for (const section of platformFilteredSections) {
      for (const entry of section.entries) {
        const score = scoreMatch(section, entry, searchTokens);
        if (score > 0) {
          scoredEntries.push({ section, entry, score });
        }
      }
    }

    // Sort by score descending
    scoredEntries.sort((a, b) => b.score - a.score);

    // Group back into sections while preserving score order
    const sectionMap = new Map<string, ShortcutEntry[]>();
    const sectionOrder: string[] = [];

    for (const { section, entry } of scoredEntries) {
      const key = section.title;
      if (!sectionMap.has(key)) {
        sectionMap.set(key, []);
        sectionOrder.push(key);
      }
      sectionMap.get(key)!.push(entry);
    }

    // Rebuild sections in the order they first appeared (by highest-scored entry)
    filteredSections = sectionOrder.map((title) => {
      const originalSection = platformFilteredSections.find((s) => s.title === title)!;
      return {
        ...originalSection,
        entries: sectionMap.get(title)!,
      };
    });
  }

  return (
    <List
      searchBarPlaceholder="Search keybindings..."
      onSearchTextChange={setSearchText}
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by Platform" value={platformFilter} onChange={setPlatformFilter}>
          <List.Dropdown.Item title="All" value="all" />
          <List.Dropdown.Item title="Aerospace" value="Aerospace" />
          <List.Dropdown.Item title="Applications" value="Applications" />
          <List.Dropdown.Item title="Ghostty" value="Ghostty" />
          <List.Dropdown.Item title="macOS" value="macOS" />
          <List.Dropdown.Item title="Microsoft Teams" value="Microsoft Teams" />
          <List.Dropdown.Item title="Neovim" value="Neovim" />
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
