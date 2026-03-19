#!/usr/bin/env python3
"""Generic Unicode table renderer for JSON arrays.

Default mode (no flags): backward-compatible reminders table grouped by listName.
Custom mode (--columns): render any JSON with specified columns and optional header.

Examples:
    # Reminders-style list output
    remindctl show open --json | python3 format_table.py

    # Custom columns with a section label
    echo '[{"#":1,"title":"Fix bug","recommend":"keep today"}]' | \
        python3 format_table.py --columns "#,Title,Recommend" --header "Overdue"
"""

import argparse
import json
import sys
import textwrap

MAX_TABLE_WIDTH = 84
MIN_COL_WIDTH = 6
PADDING = 1
COMPACT_THRESHOLD = 15


def wrap_text(value, width):
    """Wrap text into lines that fit within width, left-justified."""
    if not value:
        return ["".ljust(width)]
    if len(value) <= width:
        return [value.ljust(width)]
    lines = textwrap.wrap(value, width)
    return [line.ljust(width) for line in lines]


def make_border(widths, left, mid, right, fill="─"):
    """Build a border line from column widths."""
    segments = [fill * (width + 2 * PADDING) for width in widths]
    return left + mid.join(segments) + right


def make_row(cells, widths):
    """Render a single content row."""
    parts = []
    for cell, width in zip(cells, widths):
        parts.append(f" {cell:<{width}} ")
    return "│" + "│".join(parts) + "│"


def compute_widths(headers, rows):
    """Auto-calculate balanced column widths for the target table width."""
    natural = []
    for index, header in enumerate(headers):
        col_max = len(header)
        for row in rows:
            col_max = max(col_max, len(row[index]) if index < len(row) else 0)
        natural.append(col_max)

    count = len(headers)
    border_cost = 1 + count
    padding_cost = count * 2 * PADDING
    budget = MAX_TABLE_WIDTH - border_cost - padding_cost

    if sum(natural) <= budget:
        return natural

    compact_idx = [i for i, width in enumerate(natural) if width <= COMPACT_THRESHOLD]
    wide_idx = [i for i, width in enumerate(natural) if width > COMPACT_THRESHOLD]

    if not wide_idx:
        widest = natural.index(max(natural))
        wide_idx = [widest]
        compact_idx = [i for i in range(count) if i != widest]

    compact_total = sum(natural[i] for i in compact_idx)
    remaining = budget - compact_total
    wide_total = sum(natural[i] for i in wide_idx)

    widths = list(natural)
    for index in wide_idx:
        share = int(remaining * natural[index] / wide_total)
        widths[index] = max(share, MIN_COL_WIDTH)

    return widths


def render_table(headers, rows, header_label=None):
    """Render a single Unicode table with an optional section label."""
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

    for row_index, row in enumerate(rows):
        padded = list(row) + [""] * (len(headers) - len(row))
        wrapped_cols = []
        for cell, width in zip(padded, widths):
            wrapped_cols.append(wrap_text(cell, width))

        max_lines = max(len(column) for column in wrapped_cols)
        for line_index in range(max_lines):
            cells = []
            for col_index, column in enumerate(wrapped_cols):
                if line_index < len(column):
                    cells.append(column[line_index])
                else:
                    cells.append("".ljust(widths[col_index]))
            lines.append(make_row(cells, widths))

        if row_index < len(rows) - 1:
            lines.append(sep)

    lines.append(bot)
    return "\n".join(lines)


def format_custom(data, columns, header):
    """Render explicit columns using case-insensitive JSON key lookup."""
    if not data:
        label = header or "Results"
        print(f"No {label.lower()} found.")
        return

    headers = [column.strip() for column in columns.split(",")]
    rows = []
    for record in data:
        lower_map = {key.lower(): value for key, value in record.items()}
        row = []
        for header_name in headers:
            value = lower_map.get(header_name.lower(), "")
            row.append(str(value) if value is not None else "")
        rows.append(row)

    print(render_table(headers, rows, header_label=header))


def format_reminders(data):
    """Render reminders-style output grouped by listName."""
    if not data:
        print("No reminders found.")
        return

    by_list = {}
    for reminder in data:
        list_name = reminder.get("listName", "Unknown")
        by_list.setdefault(list_name, []).append(reminder)

    for list_name in by_list:
        by_list[list_name].sort(key=lambda reminder: reminder.get("dueDate") or "9999")

    headers = ["#", "Title", "Due", "Pri"]
    first = True
    for list_name, items in by_list.items():
        if not first:
            print()
        first = False

        rows = []
        for index, reminder in enumerate(items, 1):
            title = reminder.get("title", "")
            due = reminder.get("dueDate", "")
            due = due[:10] if due else "—"
            priority = reminder.get("priority", "none")
            priority = "—" if priority == "none" else priority
            rows.append([str(index), title, due, priority])

        print(render_table(headers, rows, header_label=list_name))


def main():
    parser = argparse.ArgumentParser(description="Render JSON arrays as Unicode tables.")
    parser.add_argument(
        "--columns",
        help="Comma-separated column names matching JSON keys case-insensitively.",
    )
    parser.add_argument(
        "--header",
        help="Label printed above the table, such as Overdue or Jira New.",
    )
    args = parser.parse_args()

    data = json.load(sys.stdin)

    if args.columns:
        format_custom(data, args.columns, args.header)
    else:
        format_reminders(data)


if __name__ == "__main__":
    main()
