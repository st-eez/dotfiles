#!/usr/bin/env python3
"""Write agenda planning state with a normalized timestamp."""

import argparse
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


def read_existing_timezone(path: Path) -> str | None:
    """Return a saved timezone from an existing state file if present."""
    if not path.exists():
        return None
    try:
        loaded = json.loads(path.read_text())
    except Exception:
        return None
    if not isinstance(loaded, dict):
        return None
    timezone = loaded.get("timezone")
    if not isinstance(timezone, str) or not timezone.strip():
        return None
    return timezone


def main() -> None:
    parser = argparse.ArgumentParser(description="Write normalized agenda state.")
    parser.add_argument("state_file", help="Path to the agenda state file")
    parser.add_argument(
        "--default-timezone",
        default="America/Montreal",
        help="Fallback timezone when none exists in state",
    )
    parser.add_argument(
        "--timezone",
        help="Explicit timezone override",
    )
    args = parser.parse_args()

    path = Path(args.state_file)
    timezone = args.timezone or read_existing_timezone(path) or args.default_timezone
    timestamp = datetime.now(ZoneInfo(timezone)).strftime("%Y-%m-%d %H:%M")

    state = {
        "last_planning_completed_at": timestamp,
        "timezone": timezone,
    }

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2) + "\n")
    print(json.dumps(state, indent=2))


if __name__ == "__main__":
    main()
