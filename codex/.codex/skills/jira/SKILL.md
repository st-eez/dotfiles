---
name: jira
description: Manage Jira work items using the `acli` CLI and Jira REST API. Use when the user mentions Jira, tickets, work items, sprints, backlogs, or asks to search, create, update, transition, comment on, assign, or log time on a ticket. Trigger on requests such as "what's assigned to me", "create a ticket for X", "move that to done", "log 2 hours on NS-123", or references to ticket keys like `XX-123`.
---

# Jira

Use `acli` as the primary interface to Jira Cloud. Resolve site and user information from `~/.config/acli/jira_config.yaml` at runtime and never hardcode it.

## Rules

1. Always use `workitem`, not `issue`, for `acli jira` commands.
2. Exclude terminal statuses in searches by default: `status NOT IN ("Done","Closed","Canceled")`.
3. Use `NOT IN`, never `!=`, in JQL.
4. Use JQL with `--jql` for searches rather than shorthand flags.
5. Add `--yes` to edit, transition, and assign commands to avoid interactive prompts.

## Discovery

On first Jira use in a conversation, discover the available projects:

```sh
acli jira project list
```

Use discovered project keys in later JQL. To discover issue types for a project, inspect a recent work item and check its `issuetype` field.

## Search Work Items

```sh
acli jira workitem search --jql 'project = XX AND assignee = currentUser() AND status NOT IN ("Done","Closed","Canceled")' --fields "key,summary,status,priority" --csv
acli jira workitem search --jql 'project = XX AND text ~ "search term" AND status NOT IN ("Done","Closed","Canceled")' --csv
acli jira workitem search --jql 'project = XX AND status = "In Progress"' --count
acli jira workitem search --jql 'project = XX AND assignee = currentUser() AND status NOT IN ("Done","Closed","Canceled")' --paginate --csv
```

## View A Work Item

```sh
acli jira workitem view XX-123
acli jira workitem view XX-123 --fields '*navigable'
acli jira workitem view XX-123 --fields 'summary,status,comment,timetracking'
acli jira workitem view XX-123 --json
acli jira workitem view XX-123 --web
```

## Create A Work Item

```sh
acli jira workitem create \
  --project "XX" \
  --type "Task" \
  --summary "Brief description" \
  --description "Detailed explanation" \
  --assignee "@me"
```

Some Jira Service Management projects require custom fields that have no direct CLI flag. When `acli` reports a required custom field, use `--from-json` with `additionalAttributes` and discover the field ID from Jira metadata or an existing work item.

Example:

```sh
acli jira workitem view XX-123 --fields '*navigable' --json
```

Then create with JSON:

```sh
acli jira workitem create --from-json /tmp/jira_ticket.json
```

JSON payload shape:

```json
{
  "projectKey": "XX",
  "type": "Get IT help",
  "summary": "Brief description",
  "description": {
    "type": "doc",
    "version": 1,
    "content": [
      {
        "type": "paragraph",
        "content": [
          {
            "type": "text",
            "text": "Details here"
          }
        ]
      }
    ]
  },
  "additionalAttributes": {
    "customfield_10043": {
      "value": "Medium"
    }
  }
}
```

For rich descriptions, use `--description-file` with Atlassian Document Format.

## Edit A Work Item

```sh
acli jira workitem edit --key "XX-123" --summary "Updated title" --yes
acli jira workitem edit --from-json /tmp/edit.json --yes
```

JSON edit template:

```json
{
  "issues": ["XX-123"],
  "summary": "New title",
  "assignee": "user@email.com",
  "labelsToAdd": ["label1"],
  "labelsToRemove": ["old-label"],
  "type": "Task"
}
```

## Transition A Work Item

```sh
acli jira workitem transition --key "XX-123" --status "In Progress" --yes
acli jira workitem transition --key "XX-123" --status "Done" --yes
```

## Assign A Work Item

```sh
acli jira workitem assign --key "XX-123" --assignee "@me" --yes
acli jira workitem assign --key "XX-123" --assignee "user@email.com" --yes
acli jira workitem assign --key "XX-123" --remove-assignee --yes
```

## Comment On A Work Item

```sh
acli jira workitem comment create --key "XX-123" --body "Comment text here"
acli jira workitem comment list --key "XX-123"
```

## Link Work Items

```sh
acli jira workitem link type
acli jira workitem link create --inward-key "XX-123" --outward-key "YY-456" --type "Relates"
```

## Sprint Operations

```sh
acli jira sprint view --id 123
acli jira sprint list-workitems --id 123
```

## Work Logging

`acli` does not support Jira worklogs. Use the bundled helper, which reads authentication from the `acli` config and macOS Keychain.

```sh
python3 "$HOME/.codex/skills/jira/scripts/jira_worklog.py" add XX-123 2h --comment "Description of work"
python3 "$HOME/.codex/skills/jira/scripts/jira_worklog.py" add XX-123 30m
python3 "$HOME/.codex/skills/jira/scripts/jira_worklog.py" add XX-123 1h --started "2026-03-15T09:00:00.000-0400"
python3 "$HOME/.codex/skills/jira/scripts/jira_worklog.py" list XX-123
python3 "$HOME/.codex/skills/jira/scripts/jira_worklog.py" delete XX-123 <worklog-id>
```

Accepted time strings include `1h`, `30m`, `1h 30m`, and `2d`.

## Output

- Use `--csv` for readable tabular search output.
- Use `--json` when you need structured fields for follow-up work.
- Include `key` and `summary` in search output unless there is a reason not to.
