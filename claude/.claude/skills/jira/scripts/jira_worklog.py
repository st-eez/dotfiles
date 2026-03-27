#!/usr/bin/env python3
"""Jira worklog management via REST API.

Bridges the gap in acli which lacks worklog support.
Reads site/account info from acli's config and OAuth tokens from macOS Keychain.
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

try:
    import yaml
except ImportError:
    yaml = None

ACLI_CONFIG_DIR = Path.home() / ".config" / "acli"
KEYCHAIN_SERVICE = "acli"


def _parse_yaml_simple(text):
    """Minimal YAML parser for acli config (avoids PyYAML dependency).

    Only handles the flat key-value and simple list-of-dicts structure
    that acli's jira_config.yaml uses.
    """
    result = {"profiles": []}
    current_profile = None
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if line.startswith("    - ") or line.startswith("    -"):
            current_profile = {}
            result["profiles"].append(current_profile)
            rest = stripped.lstrip("- ").strip()
            if ":" in rest:
                k, v = rest.split(":", 1)
                current_profile[k.strip()] = v.strip()
        elif current_profile is not None and line.startswith("      "):
            if ":" in stripped:
                k, v = stripped.split(":", 1)
                current_profile[k.strip()] = v.strip()
        else:
            if ":" in stripped:
                k, v = stripped.split(":", 1)
                result[k.strip()] = v.strip()
    return result


def load_acli_config():
    """Load Jira site and account info from acli's config."""
    config_path = ACLI_CONFIG_DIR / "jira_config.yaml"
    if not config_path.exists():
        print("Error: acli config not found at", config_path, file=sys.stderr)
        print("Run 'acli auth login' first.", file=sys.stderr)
        sys.exit(1)

    text = config_path.read_text()
    if yaml:
        config = yaml.safe_load(text)
    else:
        config = _parse_yaml_simple(text)

    current = config.get("current_profile", "")
    profiles = config.get("profiles", [])
    if not profiles:
        print("Error: no Jira profiles found in acli config.", file=sys.stderr)
        sys.exit(1)

    # Match current_profile or fall back to first profile
    profile = profiles[0]
    for p in profiles:
        profile_id = f"{p.get('cloud_id')}:{p.get('account_id')}"
        if profile_id == current or f"{p.get('cloud_id')}:{p.get('account_id')}" in current:
            profile = p
            break

    return {
        "site": profile["site"],
        "cloud_id": profile["cloud_id"],
        "account_id": profile["account_id"],
        "email": profile.get("email", ""),
        "auth_type": profile.get("auth_type", "oauth"),
    }


def get_token(config):
    """Retrieve the access token from macOS Keychain.

    acli stores tokens in go-keyring format: base64-encoded payload
    with a 'go-keyring-base64:' prefix. The payload is either
    gzip-compressed JSON (OAuth) or a plain API token string.
    """
    import base64
    import gzip

    keychain_account = f"jira:{config['cloud_id']}:{config['account_id']}"
    try:
        result = subprocess.run(
            ["security", "find-generic-password", "-s", KEYCHAIN_SERVICE,
             "-a", keychain_account, "-w"],
            capture_output=True, text=True, check=True
        )
        raw = result.stdout.strip()
    except subprocess.CalledProcessError:
        print("Error: Could not retrieve token from Keychain.", file=sys.stderr)
        print("Make sure you're logged in via: acli auth login", file=sys.stderr)
        sys.exit(1)

    # Decode go-keyring format: prefix → base64 → gzip JSON (OAuth) or plain (API token)
    prefix = "go-keyring-base64:"
    if raw.startswith(prefix):
        blob = base64.b64decode(raw[len(prefix):])
        try:
            data = json.loads(gzip.decompress(blob))
            return data["access_token"]
        except (gzip.BadGzipFile, OSError):
            return blob.decode()

    # Fallback: try plain JSON or raw token
    try:
        data = json.loads(raw)
        return data.get("access_token", raw)
    except json.JSONDecodeError:
        return raw


def auth_header(config, token):
    """Build the Authorization header for the active auth type."""
    import base64
    if config.get("auth_type") == "api_token":
        cred = base64.b64encode(f"{config['email']}:{token}".encode()).decode()
        return f"Basic {cred}"
    return f"Bearer {token}"


def api_request(config, method, path, body=None):
    """Make an authenticated request to the Jira REST API."""
    token = get_token(config)
    if config.get("auth_type") == "api_token":
        url = f"https://{config['site']}/rest/api/3/{path}"
    else:
        url = f"https://api.atlassian.com/ex/jira/{config['cloud_id']}/rest/api/3/{path}"
    headers = {
        "Authorization": auth_header(config, token),
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    data = json.dumps(body).encode() if body else None
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req) as resp:
            if resp.status == 204:
                return None
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


def cmd_add(args, config):
    """Add a worklog entry to a ticket."""
    body = {"timeSpent": args.time}
    if args.comment:
        body["comment"] = {
            "type": "doc", "version": 1,
            "content": [{"type": "paragraph", "content": [
                {"type": "text", "text": args.comment}
            ]}]
        }
    if args.started:
        body["started"] = args.started
    else:
        body["started"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000+0000")

    result = api_request(config, "POST", f"issue/{args.key}/worklog", body)
    if result:
        print(f"Logged {result['timeSpent']} on {args.key} (worklog ID: {result['id']})")
    else:
        print(f"Logged {args.time} on {args.key}")


def cmd_list(args, config):
    """List worklogs for a ticket."""
    result = api_request(config, "GET", f"issue/{args.key}/worklog")
    worklogs = result.get("worklogs", [])
    if not worklogs:
        print(f"No worklogs found for {args.key}")
        return

    print(f"{'ID':<8} {'Author':<25} {'Time Spent':<12} {'Started':<22} Comment")
    print("-" * 90)
    for wl in worklogs:
        author = wl.get("author", {}).get("displayName", "Unknown")
        time_spent = wl.get("timeSpent", "?")
        started = wl.get("started", "?")[:19]
        comment_body = wl.get("comment", {})
        comment_text = ""
        if comment_body and "content" in comment_body:
            for block in comment_body["content"]:
                for item in block.get("content", []):
                    if item.get("type") == "text":
                        comment_text += item.get("text", "")
        print(f"{wl['id']:<8} {author:<25} {time_spent:<12} {started:<22} {comment_text[:40]}")


def cmd_delete(args, config):
    """Delete a worklog entry."""
    api_request(config, "DELETE", f"issue/{args.key}/worklog/{args.worklog_id}")
    print(f"Deleted worklog {args.worklog_id} from {args.key}")


def main():
    config = load_acli_config()

    parser = argparse.ArgumentParser(description="Jira worklog management")
    sub = parser.add_subparsers(dest="command", required=True)

    # add
    add_p = sub.add_parser("add", help="Add a worklog entry")
    add_p.add_argument("key", help="Ticket key (e.g., NS-123)")
    add_p.add_argument("time", help="Time spent (e.g., 1h, 30m, 2h 30m)")
    add_p.add_argument("--comment", "-c", help="Work description")
    add_p.add_argument("--started", "-s", help="Start time (ISO 8601)")

    # list
    list_p = sub.add_parser("list", help="List worklogs for a ticket")
    list_p.add_argument("key", help="Ticket key")

    # delete
    del_p = sub.add_parser("delete", help="Delete a worklog entry")
    del_p.add_argument("key", help="Ticket key")
    del_p.add_argument("worklog_id", help="Worklog ID to delete")

    args = parser.parse_args()
    cmd = {"add": cmd_add, "list": cmd_list, "delete": cmd_delete}[args.command]
    cmd(args, config)


if __name__ == "__main__":
    main()
