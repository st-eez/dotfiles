---
name: agenda
description: "Structured 3-phase morning planning workflow: overdue triage, inbox/Jira awareness, and final Today slate. Use this skill whenever the user says 'plan my day', 'morning triage', 'set up today', 'daily planning', 'run agenda', 'what should I work on today', 'start my day', or anything about building the daily working set. Do NOT trigger for ad-hoc reminder queries (use the reminders skill) or ad-hoc Jira searches (use the jira skill). This is specifically for the structured daily planning ritual."
allowed-tools: Bash, Read, Write
---

# Daily Planning

Run a structured morning planning workflow that builds an intentional 3-5 item smart Today slate from Apple Reminders with Jira awareness.

Reminders is the source of truth for what Steve might need to do. Jira is an awareness layer for active shared NS and IT work. The goal is to reduce cognitive load and get Steve to an intentional day quickly.

## Runtime Setup

Resolve these paths once at the start of every planning run:

```sh
SKILL_DIR="$HOME/.claude/skills/agenda"
FORMAT_TABLE="$SKILL_DIR/scripts/format_table.py"
READ_STATE="$SKILL_DIR/scripts/read_state.py"
WRITE_STATE="$SKILL_DIR/scripts/write_state.py"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/agenda"
STATE_FILE="$STATE_DIR/daily-planning-state.json"
mkdir -p "$STATE_DIR"
```

If `FORMAT_TABLE`, `READ_STATE`, or `WRITE_STATE` is missing, explain that the skill install is incomplete and stop.

This `SKILL.md` is the runtime source of truth. Do not read other planning docs during a normal pass unless Steve explicitly asks.

## Formatting Script

All phase output uses the bundled table renderer at `scripts/format_table.py`. Use the same output structure as the reminders skill, but do not depend on the reminders skill at runtime.

When you want the rendered table to appear in your final assistant message instead of noisy Bash output, use this pattern:

1. Render to a temp file, not stdout.
2. Use the Read tool on that temp file.
3. Include the table contents exactly once in your reply.
4. Do not print the table from Bash and then repeat it again in prose.

For multiple tables, use one temp file per table.

**Default mode** (no flags) is for raw `remindctl` output grouped by `listName` with `#/Title/Due/Pri` columns:

```sh
TABLE_FILE="$(mktemp)"
remindctl show open --json | python3 "$FORMAT_TABLE" > "$TABLE_FILE"
```

**Custom mode** (`--columns`) is for phase recommendations with judgment columns:

```sh
TABLE_FILE="$(mktemp)"
echo '[{"#":1,"title":"...","recommend":"keep today","jira":"NS-678","why":"..."}]' \
  | python3 "$FORMAT_TABLE" --columns "#,Title,Recommend,Jira,Why" --header "Overdue" > "$TABLE_FILE"
```

Always pipe phase tables through `"$FORMAT_TABLE"`. Never hand-draw tables or use markdown tables.

## Data Fetching Convention

All fetches use one rule:

1. Run the fetch command with `--json`.
2. Redirect stdout to a temp file.
3. Use the Read tool on that temp file.
4. Reason from the Read result, not from noisy Bash output.

Pattern:

```sh
RAW_FILE="$(mktemp)"
remindctl show overdue --json > "$RAW_FILE"
```

Do this for all reminder and Jira fetches during planning.

For mutation commands that change reminders or state and do not need inspection, discard normal stdout:

```sh
remindctl edit <ID_PREFIX> --due today --json --no-input > /dev/null
```

`/dev/null` is the null device. Redirecting with `> /dev/null` throws away normal command output but still lets errors surface on stderr.

## State File

`STATE_FILE` is a tiny cursor, not a second task system:

```json
{
  "last_planning_completed_at": null,
  "timezone": "America/Montreal"
}
```

State rules:
- If `STATE_FILE` is missing, invalid JSON, or not an object, treat it as the default above.
- Use the **date-only** portion (`YYYY-MM-DD`) of `last_planning_completed_at` when building Jira delta queries.
- Reuse the stored `timezone` if present; otherwise default to `America/Montreal`.
- Only write `STATE_FILE` after the final slate is approved and all reminder edits are applied.

Use the bundled scripts instead of ad hoc shell snippets:

```sh
python3 "$READ_STATE" "$STATE_FILE"
python3 "$READ_STATE" "$STATE_FILE" --field cursor_date
python3 "$READ_STATE" "$STATE_FILE" --field timezone
python3 "$WRITE_STATE" "$STATE_FILE" --default-timezone "America/Montreal"
```

## Reading Reminder Notes

After fetching reminders in any phase, read the `notes` field of each reminder before forming recommendations.

### Extraction rules

- Look for lines starting with `Next:`, `Jira:`, and `Waiting on:`.
- If a line starting with `Jira:` contains a ticket key (e.g. `NS-678`, `IT-574`), use that exact key in the Jira column. If `Jira:` is `none`, absent, or malformed, leave the Jira column blank. Do not infer Jira keys from the title.
- For Jira, Next, and Waiting on interpretation, prefer structured note lines over title wording. Still respect the actual title, due date, list, and reminder state.
- If no structured note lines exist, fall back to title-based judgment.

### Using notes in recommendations

- Use `Next:` to write a more specific Why. Compress the insight rather than quoting long note text verbatim. Keep Why short and table-friendly: one compact reason, not a restatement of the whole note.
- `Waiting on:` signals a blocked item. In overdue triage, bias toward `redate` or `clear due date` rather than `keep today`. In the final slate, treat blocked items as weak Today candidates unless the next action is explicitly a follow-up due now.
- When a reminder has no notes or no structured lines, work from the title alone — do not fabricate context.

## Non-Negotiables

- Use absolute paths everywhere.
- Use `remindctl` with `--json` on every command.
- Use ID prefixes (for example `4A83`) when targeting reminders. Never use numeric indexes.
- Do not run `remindctl --help` or `acli ... --help` during planning.
- Do not dump the full Jira queue or full backlog unless the Today slate is still underfilled after phases 1 and 2.
- Do not change reminders or Jira until Steve approves the current phase.
- Apply approved edits immediately after the phase they belong to. Do not batch them to the end.
- Treat recurring operational reminders like `Plan today in Agenda` as meta. They do not count toward the 3-5 work-item limit.
- Weekly review is out of scope.
- Always fetch the real system time before writing `STATE_FILE`. Never estimate or hardcode timestamps.
- Do not invent commitments that are not already captured.
- Do not bulk-create Jira tickets from backlog during planning.
- Do not delete reminders just because they look old.
- Do not set due dates without a clear reason.

## Critical Rules Summary

The items below are the execution invariants that matter most during a planning pass:

- **Tool boundaries**: Reminders is the source of truth. Jira is an awareness and shared-execution layer for active NS and IT work. Obsidian is notes, not tasks.
- **Today target**: target 3 items and use 5 only as a hard ceiling.
- **Due dates**: use only for real deadlines, true scheduled action, follow-up dates, or deliberate Today selection.
- **List semantics**:
  - `Inbox`: raw capture only
  - `Dumak`, `Dimakos Legal`, `Personal`: core work backlogs
  - `Ideas`: parking lot, not committed work
  - `Groceries`: shopping only, never a normal planning candidate
  - if old lists still appear: treat `steez` as `Personal`, treat `Dumak Releases` as a duplicate-risk Dumak item, and treat `PA` as likely stale
- **No waiting list**: blocked items stay in their normal list with `Waiting on:` notes or a real follow-up date.
- **Reminder standard**: default to one reminder per commitment or project. For larger work, notes should usually include:

```text
Next: one concrete next move
Jira: NS-664 / IT-574 / none
```

- **When Jira starts**: create or link Jira only when work becomes shared execution. Do not create tickets for raw backlog, vague ideas, or personal reminders.
- **Jira rule of thumb**: NetSuite or dev work maps to `NS`; IT or helpdesk work maps to `IT`; one clear open match means link it, multiple plausible matches means ask.

## Workflow

Run the phases in order. Do not merge them into one giant data-gathering pass.

Print a progress marker at the start of each phase and a transition line before moving to the next:

```text
── Phase 1 of 3: Overdue Triage ──
✓ Phase 1 done · Next: Inbox & Jira → Today slate
✓ Phase 2 done · Next: Building Today slate
```

---

### Phase 1: Overdue Triage

Print the Phase 1 progress marker, then run:

```sh
OVERDUE_RAW="$(mktemp)"
remindctl show overdue --json > "$OVERDUE_RAW"
```

Use the Read tool on `OVERDUE_RAW`. If there are no overdue reminders, say so in one line and move to Phase 2.

If there are overdue reminders, present only those items. For each, recommend exactly one action:
- `done` for items that are complete or irrelevant
- `keep today` for items that still belong in today
- `redate` for items that should move to a specific future date
- `clear due date` for items that were never real deadlines and should return to backlog

Use numbered items for the reply surface. Keep actual reminder IDs internal. Keep explanations short and decision-oriented. Stop and wait for approval.

Render to a temp file with:

```sh
OVERDUE_TABLE="$(mktemp)"
echo '[{"#":1,"title":"...","recommend":"keep today","jira":"NS-678","why":"..."}]' \
  | python3 "$FORMAT_TABLE" --columns "#,Title,Recommend,Jira,Why" --header "Overdue" > "$OVERDUE_TABLE"
```

Then use the Read tool on `OVERDUE_TABLE` and include it once in your reply.

After the table, print:

```text
Reply with `approve`, or edits like:
- `2 keep today`
- `1 clear due`
- `3 redate monday`
```

After approval, apply edits immediately:

- `done`
  ```sh
  remindctl complete <ID_PREFIX> --json > /dev/null
  ```

- `keep today`
  ```sh
  remindctl edit <ID_PREFIX> --due today --json --no-input > /dev/null
  ```

- `redate`
  ```sh
  remindctl edit <ID_PREFIX> --due '<NEW_DATE>' --json --no-input > /dev/null
  ```

- `clear due date`
  ```sh
  remindctl edit <ID_PREFIX> --clear-due --json --no-input > /dev/null
  ```

---

### Phase 2: Inbox and Jira Awareness

Print the Phase 2 progress marker.

#### Inbox

Run:

```sh
INBOX_RAW="$(mktemp)"
remindctl open --list "Inbox" --json > "$INBOX_RAW"
```

Use the Read tool on `INBOX_RAW`.

#### Jira Delta

Read `STATE_FILE` via `python3 "$READ_STATE" "$STATE_FILE"` and determine the Jira cursor:
- If `cursor_date` is present, use it for JQL.
- If it is missing or empty, fall back to `-1d`.

With a date cursor:

```sh
JIRA_NEW_RAW="$(mktemp)"
acli jira workitem search --jql 'project IN (NS, IT) AND status NOT IN ("Done","Closed","Canceled") AND created >= "<DATE>" ORDER BY created DESC' --json > "$JIRA_NEW_RAW"
```

```sh
JIRA_CHANGED_RAW="$(mktemp)"
acli jira workitem search --jql 'project IN (NS, IT) AND status NOT IN ("Done","Closed","Canceled") AND updated >= "<DATE>" AND created < "<DATE>" ORDER BY updated DESC' --json > "$JIRA_CHANGED_RAW"
```

With fallback `-1d`:

```sh
JIRA_NEW_RAW="$(mktemp)"
acli jira workitem search --jql 'project IN (NS, IT) AND status NOT IN ("Done","Closed","Canceled") AND created >= -1d ORDER BY created DESC' --json > "$JIRA_NEW_RAW"
```

```sh
JIRA_CHANGED_RAW="$(mktemp)"
acli jira workitem search --jql 'project IN (NS, IT) AND status NOT IN ("Done","Closed","Canceled") AND updated >= -1d AND created < -1d ORDER BY updated DESC' --json > "$JIRA_CHANGED_RAW"
```

Treat Jira as a delta feed, not a second backlog review:
- `New` is the `created` query result
- `Changed` is the `updated` query result

Use the Read tool on `JIRA_NEW_RAW` and `JIRA_CHANGED_RAW`.

#### Inbox Handling

Inbox is raw capture only. When Steve promotes an Inbox item, move it out of Inbox immediately after phase approval. Default the destination list from the reminder content:

- `Dumak`: dev, admin, IT, business, vendor, helpdesk, sandbox, PR, follow-up work
- `Dimakos Legal`: legal, payroll, website, Clio, compliance, admin work
- `Personal`: personal admin, domains, side projects
- `Ideas`: parking-lot material worth keeping but not committed

If Steve says `add` for an Inbox item, treat that as approval to both set it to today and move it to the proper list. If the destination is genuinely ambiguous, state the best default with a one-line reason so Steve can correct it.

#### Phase 2 Output

Always show all three sections: Inbox, Jira New, Jira Changed. If a section has no items, print a one-line status message instead of a table.

Approval logic:
- **Inbox has items**: render the Inbox table, then Jira tables if present, then stop and wait for approval.
- **Inbox empty, Jira has items**: show Jira one-line summaries, print the transition line, and continue straight to Phase 3. No approval gate.
- **Everything empty**: print the three empty-section lines, print the transition line, and continue to Phase 3.

Inbox items use continuous numbering:

```sh
INBOX_TABLE="$(mktemp)"
echo '[{"#":1,"title":"...","bucket":"Inbox","why":"..."}]' \
  | python3 "$FORMAT_TABLE" --columns "#,Title,Bucket,Why" --header "Inbox" > "$INBOX_TABLE"
```

Jira new tickets:

```sh
JIRA_NEW_TABLE="$(mktemp)"
echo '[{"#":2,"key":"NS-680","summary":"...","status":"Open","why":"..."}]' \
  | python3 "$FORMAT_TABLE" --columns "#,Key,Summary,Status,Why" --header "Jira New" > "$JIRA_NEW_TABLE"
```

Jira changed tickets:

```sh
JIRA_CHANGED_TABLE="$(mktemp)"
echo '[{"#":3,"key":"IT-599","summary":"...","status":"In Progress","why":"..."}]' \
  | python3 "$FORMAT_TABLE" --columns "#,Key,Summary,Status,Why" --header "Jira Changed" > "$JIRA_CHANGED_TABLE"
```

If you render any of these tables, use the Read tool on the temp file(s) and include each table once in your response.

When Inbox has items, print after the tables:

```text
Reply with edits like:
- `1 add`
- `2 skip`
```

Do not edit reminders or Jira in this phase unless Steve explicitly asks. When Steve says to add an Inbox item, apply both edits immediately:

```sh
remindctl edit <ID_PREFIX> --list "<PROPER_LIST>" --due today --json --no-input > /dev/null
```

---

### Phase 3: Final Today Slate

Print the Phase 3 progress marker, then run:

```sh
TODAY_RAW="$(mktemp)"
remindctl show today --json > "$TODAY_RAW"
```

Use the Read tool on `TODAY_RAW`.

`remindctl show today --json` includes overdue reminders. By Phase 3, Phase 1 decisions should already have removed or re-dated stale carryovers. Exclude `Plan today in Agenda` and similar operational cues from the real-work count.

#### If 3-5 solid items exist

Present the slate. Identify deadlines, people waiting, and one move-the-needle item where applicable. Stop for approval.

Render the core slate and optional candidates separately:

```sh
TODAY_TABLE="$(mktemp)"
echo '[{"#":1,"title":"...","type":"Today","why":"..."}]' \
  | python3 "$FORMAT_TABLE" --columns "#,Title,Type,Why" --header "Today" > "$TODAY_TABLE"
```

```sh
OPTIONAL_TABLE="$(mktemp)"
echo '[{"#":4,"title":"...","type":"Optional","why":"..."}]' \
  | python3 "$FORMAT_TABLE" --columns "#,Title,Type,Why" --header "Optional" > "$OPTIONAL_TABLE"
```

Use the Read tool on `TODAY_TABLE` and `OPTIONAL_TABLE` if present, then include each table once in your reply.

After the tables, print:

```text
Reply with `approve`, or edits like:
- `swap 3 for <candidate>`
- `drop 2`
- `4 make today`
```

#### If fewer than 3 items

Widen carefully. Inspect only open reminders from the core work lists using the default formatter:

```sh
DUMAK_TABLE="$(mktemp)"
remindctl open --list "Dumak" --json | python3 "$FORMAT_TABLE" > "$DUMAK_TABLE"
```

```sh
LEGAL_TABLE="$(mktemp)"
remindctl open --list "Dimakos Legal" --json | python3 "$FORMAT_TABLE" > "$LEGAL_TABLE"
```

```sh
PERSONAL_TABLE="$(mktemp)"
remindctl open --list "Personal" --json | python3 "$FORMAT_TABLE" > "$PERSONAL_TABLE"
```

Use the Read tool on the table files you actually need to cite, then include them once in your reply.

Propose only 1-2 fillers. Use the priority ordering defined above: hard deadlines, people waiting, move-the-needle, quick win.

Use Jira only to confirm active shared work already linked to likely candidates. Do not summarize the entire open queue.

#### After Approval

Apply the needed reminder edits:

- Set approved backlog candidates to today:
  ```sh
  remindctl edit <ID_PREFIX> --due today --json --no-input > /dev/null
  ```

- Clear due dates from anything explicitly removed from today:
  ```sh
  remindctl edit <ID_PREFIX> --clear-due --json --no-input > /dev/null
  ```

Then update `STATE_FILE` with the local completion timestamp in `YYYY-MM-DD HH:MM` format.

```sh
python3 "$WRITE_STATE" "$STATE_FILE" --default-timezone "America/Montreal" > /dev/null
```

Only write the state file after the final slate is approved and all reminder edits are applied.

## Worked Example

Keep the interaction shape tight and predictable:

```text
── Phase 1 of 3: Overdue Triage ──
◆ Overdue
<formatted table>

Reply with `approve`, or edits like:
- `2 keep today`
- `3 redate monday`

✓ Phase 1 done · Next: Inbox & Jira → Today slate

── Phase 2 of 3: Inbox & Jira Awareness ──
Inbox is empty.
Jira: NS-680 INV-SW-206 (Waiting for support) — new since last pass

✓ Phase 2 done · Next: Building Today slate

── Phase 3 of 3: Today Slate ──
◆ Today
<formatted table>
◆ Optional
<formatted table>

Reply with `approve`, or edits like:
- `drop 2`
- `4 make today`
```
