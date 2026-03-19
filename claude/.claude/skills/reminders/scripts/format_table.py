#!/usr/bin/env python3
"""Generic Unicode table renderer for JSON arrays.

Default mode (no flags): backward-compatible reminders table grouped by listName.
Custom mode (--columns):  render any JSON with specified columns and optional header.

Examples:
    # Reminders (default, backward compatible)
    remindctl show open --json | python3 format_table.py

    # Custom columns with header
    echo '[{"#":1,"title":"Fix bug","recommend":"keep today"}]' | \
        python3 format_table.py --columns "#,Title,Recommend" --header "Overdue"
"""
import argparse
import json
import sys
import textwrap

# ── Layout constants ────────────────────────────────────────────────
MAX_TABLE_WIDTH = 84  # outer width including borders
MIN_COL_WIDTH = 6     # minimum content width for any column
PADDING = 1           # space on each side of cell content


def wrap_text(s, width):
    """Wrap text into lines that fit within width, each left-justified."""
    if not s:
        return ["".ljust(width)]
    if len(s) <= width:
        return [s.ljust(width)]
    lines = textwrap.wrap(s, width)
    return [line.ljust(width) for line in lines]


# ── Border helpers ──────────────────────────────────────────────────

def make_border(widths, left, mid, right, fill="─"):
    """Build a border line: left + fill*w + mid + fill*w + ... + right."""
    segments = [fill * (w + 2 * PADDING) for w in widths]
    return left + mid.join(segments) + right


def make_row(cells, widths):
    """Build a content row. cells is a list of strings, one per column."""
    parts = []
    for cell, w in zip(cells, widths):
        parts.append(f" {cell:<{w}} ")
    return "│" + "│".join(parts) + "│"


# ── Column width calculation ────────────────────────────────────────

COMPACT_THRESHOLD = 15  # columns at or below this width stay fixed


def compute_widths(headers, rows):
    """Auto-calculate column widths. Short columns keep natural width;
    wide columns share remaining space proportionally."""
    n = len(headers)
    # Natural width = max of header and all cell values
    natural = []
    for i in range(n):
        col_max = len(headers[i])
        for row in rows:
            col_max = max(col_max, len(row[i]) if i < len(row) else 0)
        natural.append(col_max)

    # Budget: MAX_TABLE_WIDTH minus borders and padding
    border_cost = 1 + n  # leading │ + one │ per column
    padding_cost = n * 2 * PADDING
    budget = MAX_TABLE_WIDTH - border_cost - padding_cost

    total_natural = sum(natural)
    if total_natural <= budget:
        return natural

    # Split into compact (keep natural) and wide (share remaining space)
    compact_idx = [i for i, w in enumerate(natural) if w <= COMPACT_THRESHOLD]
    wide_idx = [i for i, w in enumerate(natural) if w > COMPACT_THRESHOLD]

    # If nothing is wide, treat the single widest as the flex column
    if not wide_idx:
        widest = natural.index(max(natural))
        wide_idx = [widest]
        compact_idx = [i for i in range(n) if i != widest]

    compact_total = sum(natural[i] for i in compact_idx)
    remaining = budget - compact_total
    wide_natural_total = sum(natural[i] for i in wide_idx)

    widths = list(natural)
    for i in wide_idx:
        share = int(remaining * natural[i] / wide_natural_total)
        widths[i] = max(share, MIN_COL_WIDTH)

    return widths


# ── Renderers ───────────────────────────────────────────────────────

def render_table(headers, rows, header_label=None):
    """Render a single table with optional header label."""
    widths = compute_widths(headers, rows)

    top = make_border(widths, "╭", "┬", "╮")
    sep = make_border(widths, "├", "┼", "┤")
    bot = make_border(widths, "╰", "┴", "╯")

    lines = []
    if header_label:
        lines.append(f"◆ {header_label}")
    lines.append(top)
    lines.append(make_row(headers, widths))
    lines.append(sep)

    for idx, row in enumerate(rows):
        # Pad row to correct length
        padded = list(row) + [""] * (len(headers) - len(row))

        # Wrap every cell that exceeds its column width
        wrapped_cols = []
        for i, (cell, w) in enumerate(zip(padded, widths)):
            wrapped_cols.append(wrap_text(cell, w))

        # Render as many visual lines as the tallest cell needs
        max_lines = max(len(wc) for wc in wrapped_cols)
        for line_idx in range(max_lines):
            cells = []
            for col_idx, wc in enumerate(wrapped_cols):
                if line_idx < len(wc):
                    cells.append(wc[line_idx])
                else:
                    cells.append("".ljust(widths[col_idx]))
            lines.append(make_row(cells, widths))

        if idx < len(rows) - 1:
            lines.append(sep)

    lines.append(bot)
    return "\n".join(lines)


def format_custom(data, columns, header):
    """Render a JSON array with explicit column names."""
    if not data:
        label = header or "Results"
        print(f"No {label.lower()} found.")
        return

    # Parse column spec — column names map to JSON keys case-insensitively
    col_names = [c.strip() for c in columns.split(",")]
    headers = list(col_names)

    # Build a lowercase key map for each record
    rows = []
    for record in data:
        lower_map = {k.lower(): v for k, v in record.items()}
        row = []
        for col in col_names:
            val = lower_map.get(col.lower(), "")
            row.append(str(val) if val is not None else "")
        rows.append(row)

    print(render_table(headers, rows, header_label=header))


def format_reminders(data):
    """Default mode: backward-compatible reminders grouped by listName."""
    if not data:
        print("No reminders found.")
        return

    # Group by list
    by_list = {}
    for r in data:
        name = r.get("listName", "Unknown")
        by_list.setdefault(name, []).append(r)

    # Sort each group by due date (no date last)
    for name in by_list:
        by_list[name].sort(key=lambda r: r.get("dueDate") or "9999")

    headers = ["#", "Title", "Due", "Pri"]
    first = True
    for list_name, items in by_list.items():
        if not first:
            print()
        first = False

        rows = []
        for i, r in enumerate(items, 1):
            title = r.get("title", "")
            due = r.get("dueDate", "")
            due = due[:10] if due else "—"
            pri = r.get("priority", "none")
            pri = "—" if pri == "none" else pri
            rows.append([str(i), title, due, pri])

        print(render_table(headers, rows, header_label=list_name))


# ── CLI ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Render JSON arrays as Unicode tables."
    )
    parser.add_argument(
        "--columns",
        help="Comma-separated column names matching JSON keys (case-insensitive).",
    )
    parser.add_argument(
        "--header",
        help="Label printed above the table (e.g., 'Overdue', 'Jira New').",
    )
    args = parser.parse_args()

    data = json.load(sys.stdin)

    if args.columns:
        format_custom(data, args.columns, args.header)
    else:
        format_reminders(data)


if __name__ == "__main__":
    main()
