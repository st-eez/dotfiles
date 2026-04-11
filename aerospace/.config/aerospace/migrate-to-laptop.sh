#!/usr/bin/env bash
# migrate-to-laptop.sh
#
# Move any windows sitting on workspaces 6,7,8,9,0 down to 1,2,3,4,5 before
# swapping to the laptop aerospace profile, which only exposes five workspaces.
# Without this, windows on 6+ stay there silently — reachable by no keybinding.
#
# Mapping: 6→1, 7→2, 8→3, 9→4, 0→5  (preserves relative spacing)
#
# Safe to run from any profile; no-op on empty workspaces.

set -u

PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

command -v aerospace >/dev/null 2>&1 || exit 0

migrate() {
  local src=$1 dst=$2
  local wid
  # list-windows prints nothing (and exits nonzero on some versions) for an
  # empty workspace — swallow both cases.
  aerospace list-windows --workspace "$src" --format '%{window-id}' 2>/dev/null | while IFS= read -r wid; do
    [ -n "$wid" ] || continue
    aerospace move-node-to-workspace --window-id "$wid" "$dst" 2>/dev/null || true
  done
}

migrate 6 1
migrate 7 2
migrate 8 3
migrate 9 4
migrate 0 5
