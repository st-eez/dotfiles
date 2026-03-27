#!/usr/bin/env python3
"""Jira Forms reader via REST API.

Bridges the gap in acli which cannot read Jira Forms (ProForma) data.
Reads site/account info from acli's config and OAuth tokens from macOS Keychain.
"""

import argparse
import json
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# Reuse auth plumbing from jira_worklog
from jira_worklog import load_acli_config, get_token


def forms_api_request(config, method, path):
    """Make an authenticated request to the Jira Forms REST API."""
    token = get_token(config)
    url = f"https://api.atlassian.com/jira/forms/cloud/{config['cloud_id']}/{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }
    req = Request(url, headers=headers, method=method)
    try:
        with urlopen(req) as resp:
            return json.loads(resp.read())
    except HTTPError as e:
        error_body = e.read().decode()
        try:
            error_json = json.loads(error_body)
            msgs = error_json.get("errorMessages", [])
            errs = error_json.get("errors", {})
            detail = "; ".join(msgs) if msgs else json.dumps(errs)
        except json.JSONDecodeError:
            detail = error_body
        print(f"Error {e.code}: {detail}", file=sys.stderr)
        sys.exit(1)


def cmd_read(args, config):
    """Read form answers from a ticket."""
    # Step 1: list forms on the issue
    forms = forms_api_request(config, "GET", f"issue/{args.key}/form")
    if not forms:
        print(f"No forms found on {args.key}")
        return

    for form in forms:
        form_id = form["id"]
        form_name = form.get("name", "Unnamed form")
        submitted = form.get("submitted", False)
        status = "Submitted" if submitted else "Open"

        print(f"Form: {form_name} ({status})")
        print("=" * 60)

        # Step 2: get simplified answers
        answers = forms_api_request(
            config, "GET",
            f"issue/{args.key}/form/{form_id}/format/answers"
        )
        if not answers:
            print("  (no answers)")
            print()
            continue

        max_label = max(len(a.get("label", "")) for a in answers)
        for a in answers:
            label = a.get("label", "?")
            answer = a.get("answer", "—")
            print(f"  {label:<{max_label}}  {answer}")

        print()


def cmd_list(args, config):
    """List forms attached to a ticket (metadata only)."""
    forms = forms_api_request(config, "GET", f"issue/{args.key}/form")
    if not forms:
        print(f"No forms found on {args.key}")
        return

    print(f"{'Form Name':<40} {'Status':<12} {'ID'}")
    print("-" * 90)
    for form in forms:
        name = form.get("name", "Unnamed")
        submitted = "Submitted" if form.get("submitted") else "Open"
        print(f"{name:<40} {submitted:<12} {form['id']}")


def cmd_json(args, config):
    """Dump full form data as JSON (for debugging/automation)."""
    forms = forms_api_request(config, "GET", f"issue/{args.key}/form")
    if not forms:
        print(f"No forms found on {args.key}")
        return

    all_data = []
    for form in forms:
        form_id = form["id"]
        full = forms_api_request(
            config, "GET", f"issue/{args.key}/form/{form_id}"
        )
        all_data.append(full)

    print(json.dumps(all_data, indent=2))


def main():
    config = load_acli_config()

    parser = argparse.ArgumentParser(description="Jira Forms reader")
    sub = parser.add_subparsers(dest="command", required=True)

    # read — human-readable form answers
    read_p = sub.add_parser("read", help="Read form answers from a ticket")
    read_p.add_argument("key", help="Ticket key (e.g., IT-617)")

    # list — list forms on a ticket
    list_p = sub.add_parser("list", help="List forms attached to a ticket")
    list_p.add_argument("key", help="Ticket key")

    # json — full form data as JSON
    json_p = sub.add_parser("json", help="Dump full form data as JSON")
    json_p.add_argument("key", help="Ticket key")

    args = parser.parse_args()
    cmd = {"read": cmd_read, "list": cmd_list, "json": cmd_json}[args.command]
    cmd(args, config)


if __name__ == "__main__":
    main()
