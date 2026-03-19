#!/usr/bin/env python3
"""Read and normalize agenda planning state."""

import argparse
import json
from pathlib import Path


def load_state(path: Path, default_timezone: str) -> dict:
    """Load state from disk, falling back to normalized defaults."""
    has_state = False
    data = {}
    if path.exists():
        try:
            loaded = json.loads(path.read_text())
            if isinstance(loaded, dict):
                data = loaded
                has_state = True
        except Exception:
            data = {}

    last_planning_completed_at = data.get("last_planning_completed_at")
    if last_planning_completed_at is not None and not isinstance(last_planning_completed_at, str):
        last_planning_completed_at = None

    timezone = data.get("timezone")
    if not isinstance(timezone, str) or not timezone.strip():
        timezone = default_timezone

    cursor_date = None
    if last_planning_completed_at:
        cursor_date = last_planning_completed_at[:10]

    return {
        "last_planning_completed_at": last_planning_completed_at,
        "timezone": timezone,
        "cursor_date": cursor_date,
        "has_state": has_state,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Read normalized agenda state.")
    parser.add_argument("state_file", help="Path to the agenda state file")
    parser.add_argument(
        "--default-timezone",
        default="America/Montreal",
        help="Fallback timezone when the state file is missing or invalid",
    )
    parser.add_argument(
        "--field",
        choices=["last_planning_completed_at", "timezone", "cursor_date", "has_state"],
        help="Print a single field instead of full JSON",
    )
    args = parser.parse_args()

    state = load_state(Path(args.state_file), args.default_timezone)

    if args.field:
        value = state[args.field]
        if value is None:
            print("")
        elif isinstance(value, bool):
            print("true" if value else "false")
        else:
            print(value)
        return

    print(json.dumps(state, indent=2))


if __name__ == "__main__":
    main()
