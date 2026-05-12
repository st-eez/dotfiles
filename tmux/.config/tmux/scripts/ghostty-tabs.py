#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass


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

CAP_WIDTH = 1  # bare nf-fa-plus_circle glyph; no inner padding
NF_PLUS_CIRCLE = "󰐙"  # nf-md-plus_circle_outline (outline ring, solid +)
# Powerline rounded caps. Spelled as escapes so editors/Read tools that render
# private-use-area codepoints as zero-width don't silently strip them.
PILL_LEFT = ""   #
PILL_RIGHT = ""  #


@dataclass(frozen=True, slots=True)
class Tab:
    index: str
    title: str
    active: bool
    attention: bool
    bg: str
    cap_left: bool
    cap_right: bool


def tmux(*args: str) -> str:
    return subprocess.check_output(["tmux", *args], text=True).rstrip("\n")


def load_thm_colors() -> dict[str, str]:
    """Batch-read all @thm_* options in one subprocess call.

    tmux show-options emits `name "value"` (or `name value` when unquoted)
    one option per line — strip surrounding quotes to recover the value.
    """
    out = tmux("show-options", "-g")
    resolved: dict[str, str] = {}
    for line in out.splitlines():
        name, _, raw = line.partition(" ")
        if not name.startswith("@thm_"):
            continue
        value = raw.strip()
        if len(value) >= 2 and value[0] == '"' and value[-1] == '"':
            value = value[1:-1]
        resolved[name[len("@thm_") :]] = value
    return {key: resolved.get(key, fallback) for key, fallback in DEFAULTS.items()}


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


def render_cap(colors: dict[str, str]) -> str:
    fg = colors["overlay_0"]
    return f"{style(fg=fg, bg=colors['crust'])}{NF_PLUS_CIRCLE}"


def surface_label(session_name: str) -> str:
    prefix = "ghostty-"
    if session_name.startswith(prefix) and session_name[len(prefix) :].isdigit():
        return f"#{session_name[len(prefix) :]}"
    return f"#{session_name}" if session_name else "#?"


def render_surface_badge(label: str, colors: dict[str, str]) -> str:
    bg = colors["surface_0"]
    return "".join(
        [
            style(fg=bg, bg=colors["crust"]),
            PILL_LEFT,
            style(fg=colors["fg"], bg=bg),
            label,
            style(fg=bg, bg=colors["crust"]),
            f"{PILL_RIGHT} ",
        ]
    )


def render_tab(
    tab: Tab,
    width: int,
    colors: dict[str, str],
    cap_left_bg: str,
    cap_right_bg: str,
) -> str:
    if width <= 0:
        return ""

    if tab.active:
        bg = colors["ghostty_active_tab"]
        fg = colors["fg"]
    else:
        bg = colors["ghostty_inactive_tab"]
        fg = colors["overlay_0"]

    left_bg = cap_left_bg or colors["crust"]
    right_bg = cap_right_bg or colors["crust"]

    if width < 8:
        return f"{style(fg=fg, bg=bg)}{truncate(tab.index, width).center(width)}"

    # Always reserve 2 cap-cell columns so the content area width is
    # constant regardless of cap state — keeps the centered title and
    # shortcut from shifting when a tab transitions active/inactive.
    right_inner_pad = 1
    content_width = max(1, width - 2)
    text_width = max(1, content_width - right_inner_pad)
    dot = "●" if tab.attention else ""
    shortcut = f"⌘{tab.index}{dot}"
    content = centered_title(tab.title, shortcut, text_width)
    split = max(0, text_width - len(shortcut))

    parts: list[str] = []
    if tab.cap_left:
        parts.append(f"{style(fg=bg, bg=left_bg)}{PILL_LEFT}")
    else:
        parts.append(f"{style(fg=fg, bg=bg)} ")
    parts.append(style(fg=fg, bg=bg))
    parts.append(content[:split])
    parts.append(f"#[fg={fg},bg={bg},bold]")
    parts.append(content[split:])
    parts.append(f"#[fg={fg},bg={bg},nobold]{' ' * right_inner_pad}")
    if tab.cap_right:
        parts.append(f"{style(fg=bg, bg=right_bg)}{PILL_RIGHT}")
    else:
        parts.append(f"{style(fg=fg, bg=bg)} ")
    return "".join(parts)


def parse_tabs(rows: list[list[str]], colors: dict[str, str]) -> list[Tab]:
    """One-pass normalization: pad fields, derive active/attention/caps/bg.

    Cap rule: the active tab always gets rounded caps on both sides; an
    inactive tab is rounded only on its outer edge (position 0's left,
    last position's right). All other inactive boundaries stay flat so
    adjacent inactives can merge into one continuous pill.
    """
    last = len(rows) - 1
    tabs: list[Tab] = []
    for position, fields in enumerate(rows):
        padded = (fields + ["", "", "", ""])[:4]
        active = padded[2] == "1"
        tabs.append(
            Tab(
                index=padded[0],
                title=padded[1],
                active=active,
                attention=padded[3] not in ("", "0"),
                bg=colors["ghostty_active_tab"] if active else colors["ghostty_inactive_tab"],
                cap_left=active or position == 0,
                cap_right=active or position == last,
            )
        )
    return tabs


def main() -> int:
    if len(sys.argv) < 3:
        return 1

    client_width = max(1, int(sys.argv[1]))
    session_id = sys.argv[2]
    # argv[3] is window_id, passed only to bust tmux's #() cache on window switch.
    # Without it the cache key stays constant across switches and the tab row
    # serves stale output until the next status-interval tick.
    session_name = sys.argv[4] if len(sys.argv) > 4 else ""

    colors = load_thm_colors()
    badge_label = surface_label(session_name)
    badge_width = len(badge_label) + 3

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

    tabs = parse_tabs(windows, colors)
    last_index = len(tabs) - 1

    # 1-col gap between the last tab's trailing curve and the cap glyph;
    # zero touches the tab's rounded edge and reads as overlap.
    cap_gap = 1
    # Symmetric edge padding so neither tab 1 nor the cap is flush with
    # the window border.
    edge_pad = 1
    left_pad = edge_pad
    # Extra col on the right so the new-window cap doesn't kiss the window
    # border; 1 col reads as "touching", 2 reads as proper inset.
    right_pad = edge_pad + 1
    right_reserve = cap_gap + CAP_WIDTH + right_pad
    reserved = left_pad + badge_width + right_reserve
    available = max(1, client_width - reserved)

    # Inter-tab gap rule (matches ghostty native):
    #   - mixed (one rounded, one flat): no gap; rounded cap blends into neighbor.
    #   - both flat (adjacent inactives): no gap; they merge into one continuous pill.
    #   - both rounded: 1-col bar-bg gap so the two curves don't visually overlap.
    pair_gaps = [
        1 if (tabs[i - 1].cap_right and tabs[i].cap_left) else 0
        for i in range(1, len(tabs))
    ]

    total_gap = sum(pair_gaps)
    tab_area = max(len(tabs), available - total_gap)
    base_width = tab_area // len(tabs)
    remainder = tab_area % len(tabs)

    parts: list[str] = []
    parts.append(f"{style(fg=colors['fg'], bg=colors['crust'])}{' ' * left_pad}")
    parts.append(render_surface_badge(badge_label, colors))

    if len(tabs) == 1:
        parts.append(f"{style(fg=colors['fg'], bg=colors['crust'])}{' ' * right_pad}")
        output = "".join(parts) + style(fg=colors["fg"], bg=colors["crust"])
        print(output, end="")
        return 0

    def neighbor_bg(position: int, side: str) -> str:
        # Blend a tab's cap into the adjacent pill when they share a flat
        # boundary; otherwise default to bar bg (handled by render_tab).
        if side == "left":
            has_cap = tabs[position].cap_left
            neighbor_pos = position - 1
            gap_idx = position - 1
        else:
            has_cap = tabs[position].cap_right
            neighbor_pos = position + 1
            gap_idx = position
        if not has_cap or not (0 <= neighbor_pos <= last_index):
            return ""
        return tabs[neighbor_pos].bg if pair_gaps[gap_idx] == 0 else ""

    for position, tab in enumerate(tabs):
        width = base_width + (1 if position < remainder else 0)
        # range=user|N (not range=window|N): tmux populates `mouse_window`
        # from the `|N` argument only during its own window-status iteration,
        # not for ranges emitted via `#()` shell substitution. A
        # `select-window -t=` (which resolves through `mouse_window`)
        # silently no-ops for those clicks. `user|<arg>` exposes the
        # argument via `mouse_status_range`, which the MouseDown1/3Status
        # bindings read in tmux.conf.
        parts.append(
            f"#[range=user|{tab.index}]"
            + render_tab(tab, width, colors, neighbor_bg(position, "left"), neighbor_bg(position, "right"))
            + "#[norange]"
        )
        if position != last_index and pair_gaps[position]:
            parts.append(f"{style(fg=colors['fg'], bg=colors['crust'])} ")

    parts.append(f"{style(fg=colors['fg'], bg=colors['crust'])}{' ' * cap_gap}")
    parts.append(f"#[range=user|new-window]{render_cap(colors)}#[norange]")
    parts.append(f"{style(fg=colors['fg'], bg=colors['crust'])}{' ' * right_pad}")

    output = "".join(parts) + style(fg=colors["fg"], bg=colors["crust"])
    print(output, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
