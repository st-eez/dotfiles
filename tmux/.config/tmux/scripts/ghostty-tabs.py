#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys


DEFAULTS = {
    "crust": "#0d0d0d",
    "fg": "#eaeaea",
    "surface_0": "#2a2a2a",
    "surface_1": "#343434",
    "surface_2": "#8a8a8a",
    "overlay_0": "#8a8a8a",
    "overlay_2": "#666666",
    "teal": "#c94f4f",
    "ghostty_active_tab": "#4a4a4a",
    "ghostty_inactive_tab": "#242424",
}


def tmux(*args: str) -> str:
    return subprocess.check_output(["tmux", *args], text=True).rstrip("\n")


def option(name: str, fallback: str) -> str:
    value = tmux("show-option", "-gqv", name)
    return value or fallback


def style(**attrs: str) -> str:
    return "#[" + ",".join(f"{key}={value}" for key, value in attrs.items() if value) + "]"


def truncate(text: str, width: int) -> str:
    if width <= 0:
        return ""
    if len(text) <= width:
        return text
    if width == 1:
        return "…"
    return text[: width - 1] + "…"


def centered_title(title: str, shortcut: str, width: int) -> str:
    if width <= 0:
        return ""

    shortcut_width = len(shortcut)
    title_width = max(1, width - shortcut_width - 1)
    title = truncate(title, title_width).center(title_width)
    text = f"{title} {shortcut}"
    return text[:width].ljust(width)


def render_tab(index: str, title: str, active: bool, attention: bool, width: int, colors: dict[str, str]) -> str:
    if width <= 0:
        return ""
    if width < 8:
        label = truncate(index, width)
        bg = colors["ghostty_active_tab"] if active else colors["ghostty_inactive_tab"]
        fg = colors["fg"] if active else colors["overlay_2"]
        return f"{style(fg=fg, bg=bg)}{label.center(width)}"

    bg = colors["ghostty_active_tab"] if active else colors["ghostty_inactive_tab"]
    fg = colors["fg"] if active else colors["overlay_0"]
    shortcut_fg = colors["fg"] if active else colors["overlay_2"]
    dot = "●" if attention else ""
    shortcut = f"⌘{index}{dot}"
    content_width = width - 2
    content = centered_title(title, shortcut, content_width)

    return "".join(
        [
            style(fg=bg, bg=colors["crust"]),
            "",
            style(fg=fg, bg=bg),
            content[: max(0, content_width - len(shortcut))],
            style(fg=shortcut_fg, bg=bg),
            content[max(0, content_width - len(shortcut)) :],
            style(fg=bg, bg=colors["crust"]),
            "",
        ]
    )


def main() -> int:
    if len(sys.argv) < 3:
        return 1

    client_width = max(1, int(sys.argv[1]))
    session_id = sys.argv[2]

    colors = {key: option(f"@thm_{key}", fallback) for key, fallback in DEFAULTS.items()}

    rows = tmux(
        "list-windows",
        "-t",
        session_id,
        "-F",
        "#{window_index}\t#{window_name}\t#{window_active}\t#{@agent_monitor_attention}",
    ).splitlines()
    windows = [row.split("\t") for row in rows if row]
    if not windows:
        return 0

    available = client_width
    gap = 1 if len(windows) > 1 else 0
    total_gap = gap * (len(windows) - 1)
    tab_area = max(len(windows), available - total_gap)
    base_width = tab_area // len(windows)
    remainder = tab_area % len(windows)

    parts: list[str] = []
    for position, fields in enumerate(windows):
        index, title, active, attention = (fields + ["", "", "", ""])[:4]
        width = base_width + (1 if position < remainder else 0)
        attention_on = attention not in ("", "0")
        parts.append(
            f"#[range=window|{index}]"
            + render_tab(index, title, active == "1", attention_on, width, colors)
            + "#[norange]"
        )
        if gap and position != len(windows) - 1:
            parts.append(f"{style(fg=colors['fg'], bg=colors['crust'])} ")

    output = "".join(parts)
    output += style(fg=colors["fg"], bg=colors["crust"])
    print(output, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
