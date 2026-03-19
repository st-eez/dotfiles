#!/usr/bin/env python3
"""Programmatic tests for format_table.py covering all agenda phase column specs,
backward compatibility, edge cases, and structural integrity."""

import json
import subprocess
import sys

SCRIPT = "/Users/stevedimakos/.claude/skills/agenda/scripts/format_table.py"
PASS = 0
FAIL = 0
RESULTS = []


def run(data, args=None):
    """Pipe JSON data through format_table.py with optional args."""
    cmd = [sys.executable, SCRIPT]
    if args:
        cmd.extend(args)
    proc = subprocess.run(
        cmd,
        input=json.dumps(data),
        capture_output=True,
        text=True,
    )
    return proc.stdout, proc.stderr, proc.returncode


def check(name, condition, detail=""):
    global PASS, FAIL
    status = "PASS" if condition else "FAIL"
    if condition:
        PASS += 1
    else:
        FAIL += 1
    RESULTS.append((name, status, detail))
    indicator = "\033[32m✓\033[0m" if condition else "\033[31m✗\033[0m"
    print(f"  {indicator} {name}")
    if not condition and detail:
        print(f"    {detail}")


def border_intact(output):
    """Check that every line with │ has matching ╭/╰/├ or │ at edges."""
    for line in output.strip().split("\n"):
        if line.startswith("◆"):
            continue
        if "│" in line or "╭" in line or "╰" in line or "├" in line:
            stripped = line.rstrip()
            if not (
                stripped.endswith("│")
                or stripped.endswith("╮")
                or stripped.endswith("╯")
                or stripped.endswith("┤")
            ):
                return False
    return True


def consistent_width(output):
    """Check that all table lines (borders + content) have the same width."""
    widths = set()
    in_table = False
    for line in output.strip().split("\n"):
        if line.startswith("◆"):
            if in_table and len(widths) > 1:
                return False
            widths = set()
            in_table = True
            continue
        if in_table and (line.startswith("╭") or line.startswith("│") or line.startswith("├") or line.startswith("╰")):
            widths.add(len(line.rstrip()))
    return len(widths) <= 1


# ══════════════════════════════════════════════════════════════════════
print("\n═══ Phase 1: Overdue — #,Title,Recommend,Jira,Why ═══")
# ══════════════════════════════════════════════════════════════════════

p1_data = [
    {"#": 1, "title": "Split Dumak South-East / South-West into child subs", "recommend": "keep today", "jira": "NS-678", "why": "active shared work already in motion"},
    {"#": 2, "title": "Investigate intercompany transaction behavior", "recommend": "clear due", "jira": "none", "why": "looks like backlog research, not a real dated item"},
    {"#": 3, "title": "Follow up w/ Stelios: PR #15", "recommend": "redate", "jira": "NS-650", "why": "follow-up should be consciously rescheduled"},
]
out, err, rc = run(p1_data, ["--columns", "#,Title,Recommend,Jira,Why", "--header", "Overdue"])

check("P1 exits cleanly", rc == 0, f"rc={rc}, stderr={err}")
check("P1 has header", "◆ Overdue" in out)
check("P1 has all column headers", all(h in out for h in ["#", "Title", "Recommend", "Jira", "Why"]))
check("P1 has all 3 rows", "keep today" in out and "clear due" in out and "redate" in out)
check("P1 has all jira keys", "NS-678" in out and "none" in out and "NS-650" in out)
check("P1 borders intact", border_intact(out))
check("P1 consistent width", consistent_width(out))
check("P1 no border overflow", all(len(line) <= 90 for line in out.split("\n")), "line > 90 chars")


# ══════════════════════════════════════════════════════════════════════
print("\n═══ Phase 2 Inbox: #,Title,Bucket,Why ═══")
# ══════════════════════════════════════════════════════════════════════

p2_inbox = [
    {"#": 1, "title": "Check shared mailbox setup for the new accounting team onboarding", "bucket": "Inbox", "why": "unprocessed capture from yesterday"},
    {"#": 2, "title": "Call dentist", "bucket": "Inbox", "why": "quick personal item"},
]
out, err, rc = run(p2_inbox, ["--columns", "#,Title,Bucket,Why", "--header", "Inbox"])

check("P2-Inbox exits cleanly", rc == 0)
check("P2-Inbox has header", "◆ Inbox" in out)
check("P2-Inbox column headers present", "Bucket" in out and "Why" in out)
check("P2-Inbox borders intact", border_intact(out))
check("P2-Inbox consistent width", consistent_width(out))


# ══════════════════════════════════════════════════════════════════════
print("\n═══ Phase 2 Jira New: #,Key,Summary,Status,Why ═══")
# ══════════════════════════════════════════════════════════════════════

p2_jira_new = [
    {"#": 1, "key": "NS-680", "summary": "INV-SW-206, INV-SW-203", "status": "Waiting for support", "why": "new NetSuite work since last planning pass"},
    {"#": 2, "key": "IT-602", "summary": "Danta Shared inbox configuration and permissions setup", "status": "Open", "why": "new IT ticket worth awareness"},
]
out, err, rc = run(p2_jira_new, ["--columns", "#,Key,Summary,Status,Why", "--header", "Jira New"])

check("P2-JiraNew exits cleanly", rc == 0)
check("P2-JiraNew has header", "◆ Jira New" in out)
check("P2-JiraNew has all keys", "NS-680" in out and "IT-602" in out)
check("P2-JiraNew has statuses", "Waiting" in out and "support" in out and "Open" in out)
check("P2-JiraNew borders intact", border_intact(out))
check("P2-JiraNew consistent width", consistent_width(out))


# ══════════════════════════════════════════════════════════════════════
print("\n═══ Phase 2 Jira Changed: #,Key,Summary,Status,Why ═══")
# ══════════════════════════════════════════════════════════════════════

p2_jira_changed = [
    {"#": 3, "key": "IT-599", "summary": "Holly Hagan laptop replacement and data migration from old machine", "status": "In Progress", "why": "changed recently, status moved forward"},
    {"#": 4, "key": "NS-678", "summary": "Split Dumak South-East / South-West into child subsidiaries", "status": "Waiting for support", "why": "already linked to overdue split reminder"},
]
out, err, rc = run(p2_jira_changed, ["--columns", "#,Key,Summary,Status,Why", "--header", "Jira Changed"])

check("P2-JiraChanged exits cleanly", rc == 0)
check("P2-JiraChanged has header", "◆ Jira Changed" in out)
check("P2-JiraChanged numbering starts at 3", "│ 3 " in out)
check("P2-JiraChanged borders intact", border_intact(out))
check("P2-JiraChanged consistent width", consistent_width(out))


# ══════════════════════════════════════════════════════════════════════
print("\n═══ Phase 3 Today: #,Title,Type,Why ═══")
# ══════════════════════════════════════════════════════════════════════

p3_today = [
    {"#": 1, "title": "Follow up w/ Stelios: PR #23", "type": "Today", "why": "people are waiting and it is already dated today"},
    {"#": 2, "title": "Split Dumak South-East / South-West into child subs", "type": "Today", "why": "active shared work already in motion"},
    {"#": 3, "title": "Build baseline NetSuite local test infrastructure", "type": "Today", "why": "move-the-needle filler if there is room"},
]
out, err, rc = run(p3_today, ["--columns", "#,Title,Type,Why", "--header", "Today"])

check("P3-Today exits cleanly", rc == 0)
check("P3-Today has header", "◆ Today" in out)
check("P3-Today has Type column", "Type" in out.split("\n")[2])
check("P3-Today all types present", out.count("Today") >= 4)  # header + 3 rows
check("P3-Today borders intact", border_intact(out))
check("P3-Today consistent width", consistent_width(out))


# ══════════════════════════════════════════════════════════════════════
print("\n═══ Phase 3 Optional: #,Title,Type,Why ═══")
# ══════════════════════════════════════════════════════════════════════

p3_optional = [
    {"#": 4, "title": "INV-SW-206, INV-SW-203", "type": "Optional", "why": "new NetSuite work, but less clearly urgent"},
]
out, err, rc = run(p3_optional, ["--columns", "#,Title,Type,Why", "--header", "Optional"])

check("P3-Optional exits cleanly", rc == 0)
check("P3-Optional has header", "◆ Optional" in out)
check("P3-Optional single row renders", "INV-SW-206" in out)
check("P3-Optional borders intact", border_intact(out))
check("P3-Optional consistent width", consistent_width(out))


# ══════════════════════════════════════════════════════════════════════
print("\n═══ Backward Compat: Default remindctl mode ═══")
# ══════════════════════════════════════════════════════════════════════

reminders_data = [
    {"title": "Buy groceries", "listName": "Personal", "dueDate": "2026-03-18", "priority": "none"},
    {"title": "Call mom about weekend plans and dinner reservation at the new Italian place downtown", "listName": "Personal", "dueDate": "2026-03-19", "priority": "high"},
    {"title": "Fix login bug in NetSuite sandbox", "listName": "Dumak", "dueDate": "", "priority": "none"},
    {"title": "Review Clio billing setup", "listName": "Dimakos Legal", "dueDate": "2026-03-20", "priority": "none"},
]
out, err, rc = run(reminders_data)

check("Compat exits cleanly", rc == 0)
check("Compat groups by list", "◆ Personal" in out and "◆ Dumak" in out and "◆ Dimakos Legal" in out)
check("Compat has default columns", all(h in out for h in ["#", "Title", "Due", "Pri"]))
check("Compat shows dates", "2026-03-18" in out)
check("Compat shows dash for no date", "—" in out)
check("Compat shows high priority", "high" in out)
check("Compat wraps long title", "Call mom about weekend" in out)
check("Compat borders intact", border_intact(out))
check("Compat consistent width per group", consistent_width(out))


# ══════════════════════════════════════════════════════════════════════
print("\n═══ Edge Cases ═══")
# ══════════════════════════════════════════════════════════════════════

# Empty data
out, err, rc = run([], ["--columns", "#,Title,Why", "--header", "Overdue"])
check("Empty custom prints message", "no overdue found" in out.lower())

out, err, rc = run([])
check("Empty default prints message", "no reminders found" in out.lower())

# Single item
out, err, rc = run(
    [{"#": 1, "title": "Solo item", "recommend": "done", "jira": "none", "why": "test"}],
    ["--columns", "#,Title,Recommend,Jira,Why", "--header", "Overdue"],
)
check("Single item renders", "Solo item" in out)
check("Single item has top and bottom border", "╭" in out and "╰" in out)
check("Single item no separator", out.count("├") == 1)  # only header separator

# Very long title + very long why (both should wrap)
out, err, rc = run(
    [{"#": 1, "title": "This is an extremely long reminder title that should definitely wrap across multiple lines in the table", "recommend": "keep today", "jira": "NS-999", "why": "This is also a very long explanation that should wrap across multiple lines to test multi-column wrapping"}],
    ["--columns", "#,Title,Recommend,Jira,Why", "--header", "Stress Test"],
)
check("Long text exits cleanly", rc == 0)
check("Long text borders intact", border_intact(out))
check("Long text consistent width", consistent_width(out))
check("Long text wraps (multiple content lines)", out.count("│ 1") == 1 and out.count("│  ") > 2)

# Case-insensitive column matching
out, err, rc = run(
    [{"TITLE": "Uppercase key", "WHY": "testing case"}],
    ["--columns", "Title,Why"],
)
check("Case-insensitive key match", "Uppercase key" in out and "testing case" in out)

# Missing key in data
out, err, rc = run(
    [{"#": 1, "title": "No jira field"}],
    ["--columns", "#,Title,Jira,Why"],
)
check("Missing key renders empty", rc == 0)
check("Missing key borders intact", border_intact(out))


# ══════════════════════════════════════════════════════════════════════
print("\n" + "═" * 50)
print(f"  Results: {PASS} passed, {FAIL} failed, {PASS + FAIL} total")
print("═" * 50)

if FAIL > 0:
    print("\nFailed tests:")
    for name, status, detail in RESULTS:
        if status == "FAIL":
            print(f"  ✗ {name}: {detail}")

sys.exit(1 if FAIL > 0 else 0)
