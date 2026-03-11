#!/bin/bash

set -u

EVENT_NAME="${1:-unknown}"
LOG_DIR="${HOME}/Library/Logs/AeroSpace"
LOG_FILE="${LOG_DIR}/focus-transitions.log"

mkdir -p "${LOG_DIR}"

append_snapshot() {
  local phase="$1"
  {
    printf '=== ts=%s event=%s phase=%s focused_ws_env=%s prev_ws_env=%s ===\n' \
      "$(/bin/date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" \
      "${EVENT_NAME}" \
      "${phase}" \
      "${AEROSPACE_FOCUSED_WORKSPACE:-}" \
      "${AEROSPACE_PREV_WORKSPACE:-}"

    printf 'focused_workspace:\n'
    aerospace list-workspaces --focused --json 2>&1

    printf 'visible_workspaces:\n'
    aerospace list-workspaces --all --format '%{workspace}|%{workspace-is-focused}|%{workspace-is-visible}|%{monitor-id}|%{monitor-name}' 2>&1

    printf 'focused_monitor:\n'
    aerospace list-monitors --focused --json 2>&1

    printf 'mouse_monitor:\n'
    aerospace list-monitors --mouse --json 2>&1

    printf 'focused_window:\n'
    aerospace list-windows --focused --json 2>&1

    printf 'all_windows:\n'
    aerospace list-windows --all --format '%{window-id}|%{app-name}|%{workspace}|%{workspace-is-focused}|%{workspace-is-visible}|%{monitor-id}|%{monitor-name}|%{window-title}' 2>&1

    printf '\n'
  } >>"${LOG_FILE}"
}

append_snapshot "immediate"

(
  /bin/sleep 0.18
  append_snapshot "settled"
) >/dev/null 2>&1 &
