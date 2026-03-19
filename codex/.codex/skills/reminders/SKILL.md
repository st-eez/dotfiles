---
name: reminders
description: Manage Apple Reminders via the `remindctl` CLI. Use when the user mentions reminders, to-do lists, things to remember, due dates for personal items, checking what is due, marking reminder items done, adding or editing items in Apple Reminders, or using `remindctl`. Trigger on requests such as "remind me to...", "what do I have due", "mark X as done", or "add X to my list". Do not use for code TODOs, GitHub issues, Jira tickets, beads tasks, or programming task tracking.
---

# Apple Reminders

Use `remindctl` as the source of truth and keep every command machine-readable.

## Rules

1. Always pass `--json` on every `remindctl` command.
2. Use `remindctl show open --json` to list incomplete reminders by default. Only use `show all` if the user explicitly asks for completed items too.
3. Use ID prefixes from JSON output for `edit`, `complete`, and `delete`. Do not use numeric indexes even though the CLI accepts them.
4. Use the bundled formatter when displaying multiple reminders. Do not hand-build reminder tables in the response.

## Common Commands

### View reminders
```sh
remindctl show open --json
remindctl show open --list "Work" --json
remindctl show today --json
remindctl show overdue --json
remindctl show tomorrow --json
remindctl show week --json
remindctl show upcoming --json
remindctl show 2026-03-18 --json
```

### Manage lists
```sh
remindctl list --json
remindctl list "Work" --json
remindctl list "Projects" --create --json
remindctl list "Work" --rename "Office" --json
remindctl list "Old" --delete --force --json
```

### Add reminders
```sh
remindctl add "Buy milk" --json
remindctl add "Call mom" --list "Personal" --due tomorrow --json
remindctl add "Review docs" --priority high --json
```

Priority values: `none`, `low`, `medium`, `high`.

### Edit reminders
```sh
remindctl edit <ID> --title "New title" --json
remindctl edit <ID> --due tomorrow --json
remindctl edit <ID> --priority high --notes "Before noon" --json
remindctl edit <ID> --clear-due --json
remindctl edit <ID> --list "Work" --json
remindctl edit <ID> --complete --json
remindctl edit <ID> --incomplete --json
```

### Complete or delete reminders
```sh
remindctl complete <ID> --json
remindctl complete <ID1> <ID2> <ID3> --json

remindctl delete <ID> --force --json
```

## Output Formatting

When showing multiple reminders, pipe JSON into the bundled formatter:

```sh
remindctl show open --json | python3 "$HOME/.codex/skills/reminders/scripts/format_table.py"
```

Keep the command as a single pipeline. The formatter groups reminders by list and renders a stable table layout.

After the table output, add a short summary that calls out overdue or high-priority items.

When a command returns a single reminder after an add, edit, complete, or delete, summarize inline instead of using the formatter:

```text
Added to Personal: "Buy milk" (due 2026-03-18)
```

## Workflow

1. Start with `remindctl show open --json` unless the user already asked for a narrower filter such as today, overdue, or a specific list.
2. Show multi-item results through `scripts/format_table.py`.
3. For mutations, run the command, then confirm the result briefly with the updated title, list, or due date.
4. If `remindctl` reports an authorization problem, inspect with `remindctl status --json` and explain the state before suggesting `authorize`.
