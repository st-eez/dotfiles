#!/usr/bin/env python3
"""Format remindctl JSON output as a rounded-corner Unicode table."""

import json
import sys
import textwrap


def wrap_title(text, width):
    """Wrap a title into multiple lines that fit within width."""
    if len(text) <= width:
        return [text.ljust(width)]
    return [line.ljust(width) for line in textwrap.wrap(text, width)]


def format_reminders(data):
    if not data:
        print("No reminders found.")
        return

    by_list = {}
    for reminder in data:
        list_name = reminder.get("listName", "Unknown")
        by_list.setdefault(list_name, []).append(reminder)

    for list_name in by_list:
        by_list[list_name].sort(key=lambda reminder: reminder.get("dueDate") or "9999")

    num_w = 4
    title_w = 55
    date_w = 12
    pri_w = 8

    def row(number, title, due, priority):
        return (
            f"│ {number:<{num_w - 1}}│ {title:<{title_w}}│ "
            f"{due:<{date_w - 1}}│ {priority:<{pri_w - 1}}│"
        )

    def sep():
        return f"├{'─' * num_w}┼{'─' * (title_w + 1)}┼{'─' * date_w}┼{'─' * pri_w}┤"

    def top():
        return f"╭{'─' * num_w}┬{'─' * (title_w + 1)}┬{'─' * date_w}┬{'─' * pri_w}╮"

    def bottom():
        return f"╰{'─' * num_w}┴{'─' * (title_w + 1)}┴{'─' * date_w}┴{'─' * pri_w}╯"

    first_list = True
    for list_name, reminders in by_list.items():
        if not first_list:
            print()
        first_list = False

        print(f"◆ {list_name}")
        print(top())
        print(row("#", "Title", "Due", "Pri"))
        print(sep())

        for index, reminder in enumerate(reminders, 1):
            title_lines = wrap_title(reminder.get("title", ""), title_w)
            due = reminder.get("dueDate", "")
            due = due[:10] if due else "—"
            priority = reminder.get("priority", "none")
            priority = "—" if priority == "none" else priority

            print(row(str(index), title_lines[0], due, priority))
            for line in title_lines[1:]:
                print(row("", line, "", ""))
            if index < len(reminders):
                print(sep())

        print(bottom())


if __name__ == "__main__":
    format_reminders(json.load(sys.stdin))
