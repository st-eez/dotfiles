#!/usr/bin/env bash

source "$CONFIG_DIR/colors.sh"
source "$CONFIG_DIR/plugins/icon_map.sh"

icon_from_app() {
  __icon_map "$1"
  printf '%s' "$icon_result"
}

# Runs on aerospace_workspace_change. Highlighting remains synchronous,
# app labels refresh asynchronously to avoid stalling AeroSpace during fast switches.

if [ "$SENDER" != "aerospace_workspace_change" ] && [ "$SENDER" != "forced" ]; then
  exit 0
fi

WORKSPACES=${WORKSPACES_OVERRIDE:-"1 2 3 4 5 6 7 8 9 0"}
FOCUSED="${AEROSPACE_FOCUSED_WORKSPACE:-}"
SKIP_ICON_REFRESH="${SKIP_ICON_REFRESH:-}"

if [ -z "$FOCUSED" ]; then
  FOCUSED=$(aerospace list-workspaces --focused 2>/dev/null || echo "")
fi

# --- Highlight update (fast path) ---

highlight_args=()
for WORKSPACE_ID in $WORKSPACES; do
  item_name="space.$WORKSPACE_ID"
  if [ "$WORKSPACE_ID" = "$FOCUSED" ]; then
    highlight_args+=(
      --set "$item_name"
      icon.highlight=true
      icon.font="JetBrainsMono Nerd Font:Bold:18.0"
      icon.padding_left=12
      icon.padding_right=2
      label.padding_left=4
      label.padding_right=18
      label.color=$WORKSPACE_ICON_ACTIVE
      label.highlight=true
      background.border_color=$TRANSPARENT
      background.color=$HIGHLIGHT_TINT
    )
  else
    highlight_args+=(
      --set "$item_name"
      icon.highlight=false
      icon.font="JetBrainsMono Nerd Font:Regular:14.0"
      icon.padding_left=12
      icon.padding_right=2
      label.padding_left=4
      label.padding_right=18
      label.color=$WORKSPACE_ICON_INACTIVE
      label.highlight=false
      background.border_color=$TRANSPARENT
      background.color=$TRANSPARENT
    )
  fi
done

if [ ${#highlight_args[@]} -gt 0 ]; then
  sketchybar "${highlight_args[@]}"
fi

sketchybar --set aerospace_workspace_controller label="$FOCUSED"

if [ "$SKIP_ICON_REFRESH" = "1" ]; then
  exit 0
fi

# --- Async label refresh (slow path) ---

PID_FILE="${TMPDIR:-/tmp}/sketchybar_space_icons.pid"

if [ -f "$PID_FILE" ]; then
  old_pid=$(cat "$PID_FILE" 2>/dev/null)
  if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
    kill "$old_pid" 2>/dev/null
  fi
fi

(
  echo $$ > "$PID_FILE"
  trap 'rm -f -- "$PID_FILE"' EXIT

  label_args=()
  for WORKSPACE_ID in $WORKSPACES; do
    apps=$(aerospace list-windows --workspace "$WORKSPACE_ID" 2>/dev/null | awk -F'|' '{gsub(/^ *| *$/, "", $2); print $2}')

    icon_strip=" "
    if [ -n "$apps" ]; then
      while read -r app_name; do
        [ -z "$app_name" ] && continue
        icon_strip+=" $(icon_from_app "$app_name")"
      done <<<"$apps"
    fi

    label_args+=(
      --set "space.$WORKSPACE_ID"
      label="$icon_strip"
    )
  done

  if [ ${#label_args[@]} -gt 0 ]; then
    sketchybar "${label_args[@]}"
  fi
) &
