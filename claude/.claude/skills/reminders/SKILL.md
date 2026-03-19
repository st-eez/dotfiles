---
name: reminders
description: "Manage Apple Reminders via the remindctl CLI. Use this skill whenever the user mentions reminders, to-do lists, things to remember, due dates for personal items, checking what's due, or remindctl. Also trigger when the user says things like 'remind me to...', 'what do I have due', 'mark X as done', or 'add X to my list'. Do NOT trigger for code TODOs, GitHub issues, Jira tickets, beads tasks, or programming task tracking."
allowed-tools: Bash
---

You are helping the user manage their Apple Reminders using the `remindctl` CLI.

## Why these rules matter

The `remindctl` CLI outputs colored human-formatted text by default, which is hard to parse and wastes tokens. Passing `--json` on every command gives you structured data you can reliably work with. Similarly, numeric indexes from `show` output shift between calls as reminders are added or completed, so always reference reminders by their stable ID prefix.

## Rules

1. **Always pass `--json`** on every `remindctl` command.
2. **Use `remindctl show open --json`** to list incomplete reminders — not `show all`, which dumps completed items and is rarely what the user wants.
3. **Use ID prefixes** (e.g., `4A83`) when targeting reminders with `edit`, `complete`, or `delete`. Never use numeric indexes — they shift between calls.

## Command Reference

### Viewing reminders
```sh
remindctl show open --json                         # All incomplete
remindctl show open --list "Work" --json            # Incomplete in a specific list
remindctl show today --json                         # Due today
remindctl show overdue --json                       # Past due
remindctl show tomorrow --json                      # Due tomorrow
remindctl show week --json                          # Due this week
remindctl show upcoming --json                      # Upcoming
remindctl show 2026-03-18 --json                    # Due on specific date
```

### List management
```sh
remindctl list --json                               # Show all lists
remindctl list "Work" --json                        # Reminders in a list
remindctl list "Projects" --create --json           # Create a list
remindctl list "Work" --rename "Office" --json      # Rename
remindctl list "Old" --delete --force --json        # Delete
```

### Adding reminders
```sh
remindctl add "Buy milk" --json
remindctl add "Call mom" --list "Personal" --due tomorrow --json
remindctl add "Review docs" --priority high --json
# Priority values: none, low, medium, high
```

### Editing reminders
```sh
remindctl edit <ID> --title "New title" --json
remindctl edit <ID> --due tomorrow --json
remindctl edit <ID> --priority high --notes "Before noon" --json
remindctl edit <ID> --clear-due --json
remindctl edit <ID> --list "Work" --json            # Move to different list
remindctl edit <ID> --complete --json               # Mark complete
remindctl edit <ID> --incomplete --json             # Undo completion
```

### Completing reminders
```sh
remindctl complete <ID> --json                      # Single
remindctl complete <ID1> <ID2> <ID3> --json         # Multiple
```

### Deleting reminders
```sh
remindctl delete <ID> --force --json
```

## Output Formatting

When displaying reminders, **always pipe the JSON through the bundled formatting script** rather than drawing tables yourself. The script handles alignment, wrapping, and borders deterministically.

```sh
remindctl show open --json | python3 ~/.claude/skills/reminders/scripts/format_table.py
```

Combine the remindctl command and the formatter into a single piped command. The script outputs rounded-corner Unicode tables grouped by list, with sequential row numbers, separator lines between rows, and long titles wrapped across multiple lines.

After the table output, add a brief summary noting overdue items or high-priority ones. You have the JSON data in context so you can map row numbers back to IDs for follow-up operations (complete, edit, delete).

When there's only a single reminder (e.g., after an add or edit), show it inline instead of piping through the script:

```
✓ Added to Personal: "Buy milk" (due 2026-03-18)
```

## Workflow

When the user asks about their reminders:
1. Start by running `remindctl show open --json` (or a more specific filter if they indicated one)
2. Present results using the table format above
3. For mutations, run the command and confirm the result with a brief inline summary
