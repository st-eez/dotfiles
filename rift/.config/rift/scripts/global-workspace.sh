#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -ne 2 ]; then
  exit 2
fi

global_workspace="$1"
action="$2"

case "$global_workspace" in
  1) target_screen_id=3; local_workspace=0 ;;
  2) target_screen_id=3; local_workspace=1 ;;
  3) target_screen_id=3; local_workspace=2 ;;
  4) target_screen_id=3; local_workspace=3 ;;
  5) target_screen_id=2; local_workspace=0 ;;
  6) target_screen_id=2; local_workspace=1 ;;
  7) target_screen_id=2; local_workspace=2 ;;
  8) target_screen_id=1; local_workspace=0 ;;
  9) target_screen_id=1; local_workspace=1 ;;
  0) target_screen_id=1; local_workspace=2 ;;
  *) exit 2 ;;
esac

if ! command -v rift-cli >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

displays_json="$(rift-cli query displays 2>/dev/null || true)"
if [ -z "$displays_json" ]; then
  exit 0
fi

target_display_index="$(
  printf '%s' "$displays_json" \
    | jq -r --argjson screen_id "$target_screen_id" 'to_entries[] | select(.value.screen_id == $screen_id) | .key' \
    | head -n 1
)"

if [ -z "$target_display_index" ] || [ "$target_display_index" = "null" ]; then
  exit 0
fi

case "$action" in
  switch)
    rift-cli execute display focus --index "$target_display_index" >/dev/null 2>&1 || true
    rift-cli execute workspace switch "$local_workspace" >/dev/null 2>&1 || true
    ;;
  move)
    rift-cli execute display move-window --index "$target_display_index" >/dev/null 2>&1 || true
    rift-cli execute display focus --index "$target_display_index" >/dev/null 2>&1 || true
    rift-cli execute workspace move-window "$local_workspace" >/dev/null 2>&1 || true
    rift-cli execute workspace switch "$local_workspace" >/dev/null 2>&1 || true
    ;;
  *)
    exit 2
    ;;
esac
