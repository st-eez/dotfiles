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

CAP_WIDTH = 1  # bare nf-fa-plus_circle glyph; no inner padding


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


NF_PLUS_CIRCLE = ""  # Nerd Font / FontAwesome plus-circle glyph


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
            "",
            style(fg=colors["fg"], bg=bg),
            label,
            style(fg=bg, bg=colors["crust"]),
            " ",
        ]
    )


def render_tab(
    index: str,
    title: str,
    active: bool,
    attention: bool,
    width: int,
    colors: dict[str, str],
    cap_left: bool = True,
    cap_right: bool = True,
    cap_left_bg: str = "",
    cap_right_bg: str = "",
) -> str:
    if width <= 0:
        return ""

    if active:
        bg = colors["ghostty_active_tab"]
        fg = colors["fg"]
    else:
        bg = colors["ghostty_inactive_tab"]
        fg = colors["overlay_0"]
    shortcut_fg = fg

    # Cap cell background. Default to bar bg (rounded edge against the strip).
    # Override with the neighbor pill's bg when there is no gap, so the cap's
    # negative space matches the neighbor and the curve blends smoothly.
    left_bg = cap_left_bg or colors["crust"]
    right_bg = cap_right_bg or colors["crust"]

    if width < 8:
        label = truncate(index, width)
        return f"{style(fg=fg, bg=bg)}{label.center(width)}"

    cap_cols = (1 if cap_left else 0) + (1 if cap_right else 0)
    right_inner_pad = 1
    content_width = max(1, width - cap_cols)
    text_width = max(1, content_width - right_inner_pad)
    dot = "●" if attention else ""
    shortcut = f"⌘{index}{dot}"
    content = centered_title(title, shortcut, text_width)

    parts: list[str] = []
    if cap_left:
        parts.append(f"{style(fg=bg, bg=left_bg)}")
    parts.append(style(fg=fg, bg=bg))
    parts.append(content[: max(0, text_width - len(shortcut))])
    parts.append(f"#[fg={shortcut_fg},bg={bg},bold]")
    parts.append(content[max(0, text_width - len(shortcut)) :])
    parts.append(f"#[fg={fg},bg={bg},nobold]{' ' * right_inner_pad}")
    if cap_right:
        parts.append(f"{style(fg=bg, bg=right_bg)}")
    return "".join(parts)


def main() -> int:
    if len(sys.argv) < 3:
        return 1

    client_width = max(1, int(sys.argv[1]))
    session_id = sys.argv[2]
    # argv[3] is window_id, passed only to bust tmux's #() cache on window switch.
    # Without it the cache key stays constant across switches and the tab row
    # serves stale output until the next status-interval tick.
    session_name = sys.argv[4] if len(sys.argv) > 4 else ""

    colors = {key: option(f"@thm_{key}", fallback) for key, fallback in DEFAULTS.items()}
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

    # 1-col gap between the last tab's trailing curve and the cap glyph;
    # zero touches the tab's rounded edge and reads as overlap.
    cap_gap = 1
    # Symmetric edge padding so neither tab 1 nor the cap is flush with
    # the window border.
    edge_pad = 1
    left_pad = edge_pad
    right_pad = edge_pad
    right_reserve = cap_gap + CAP_WIDTH + right_pad
    reserved = left_pad + badge_width + right_reserve
    available = max(1, client_width - reserved)

    # Pre-compute per-tab caps so we can size and lay out with knowledge of
    # which boundaries are flat-vs-rounded.
    last_index = len(windows) - 1
    tab_caps: list[tuple[bool, bool]] = []
    for position, fields in enumerate(windows):
        fields_padded = (fields + ["", "", "", ""])[:4]
        is_active = fields_padded[2] == "1"
        cap_left = True if is_active else position == 0
        cap_right = True if is_active else position == last_index
        tab_caps.append((cap_left, cap_right))

    # Inter-tab gap rule (matches ghostty native):
    #   - mixed (one rounded, one flat): no gap; rounded cap blends into neighbor.
    #   - both flat (adjacent inactives): no gap; they merge into one continuous pill.
    #   - both rounded: 1-col bar-bg gap so the two curves don't visually overlap.
    pair_gaps: list[int] = []
    for i in range(1, len(windows)):
        left_right = tab_caps[i - 1][1]
        right_left = tab_caps[i][0]
        pair_gaps.append(1 if (left_right and right_left) else 0)

    total_gap = sum(pair_gaps)
    tab_area = max(len(windows), available - total_gap)
    base_width = tab_area // len(windows)
    remainder = tab_area % len(windows)

    parts: list[str] = []
    parts.append(f"{style(fg=colors['fg'], bg=colors['crust'])}{' ' * left_pad}")
    parts.append(render_surface_badge(badge_label, colors))

    if len(windows) == 1:
        parts.append(f"{style(fg=colors['fg'], bg=colors['crust'])}{' ' * right_pad}")
        output = "".join(parts)
        output += style(fg=colors["fg"], bg=colors["crust"])
        print(output, end="")
        return 0

    # Per-tab pill bg so we can blend a tab's cap into its neighbor.
    tab_bgs: list[str] = []
    for fields in windows:
        is_active_bg = (fields + ["", "", "", ""])[2] == "1"
        tab_bgs.append(colors["ghostty_active_tab"] if is_active_bg else colors["ghostty_inactive_tab"])

    for position, fields in enumerate(windows):
        index, title, active, attention = (fields + ["", "", "", ""])[:4]
        width = base_width + (1 if position < remainder else 0)
        attention_on = attention not in ("", "0")
        is_active = active == "1"
        cap_left, cap_right = tab_caps[position]
        # Blend cap cells into a neighbor when there is no gap between them,
        # so the curve's negative space picks up the neighbor color.
        cap_left_bg = ""
        cap_right_bg = ""
        if cap_left and position > 0 and pair_gaps[position - 1] == 0:
            cap_left_bg = tab_bgs[position - 1]
        if cap_right and position < last_index and pair_gaps[position] == 0:
            cap_right_bg = tab_bgs[position + 1]
        parts.append(
            f"#[range=window|{index}]"
            + render_tab(
                index,
                title,
                is_active,
                attention_on,
                width,
                colors,
                cap_left,
                cap_right,
                cap_left_bg,
                cap_right_bg,
            )
            + "#[norange]"
        )
        if position != last_index and pair_gaps[position]:
            parts.append(f"{style(fg=colors['fg'], bg=colors['crust'])} ")

    parts.append(f"{style(fg=colors['fg'], bg=colors['crust'])}{' ' * cap_gap}")
    parts.append(f"#[range=user|new-window]{render_cap(colors)}#[norange]")
    parts.append(f"{style(fg=colors['fg'], bg=colors['crust'])}{' ' * right_pad}")

    output = "".join(parts)
    output += style(fg=colors["fg"], bg=colors["crust"])
    print(output, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
