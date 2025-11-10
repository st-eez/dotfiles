#!/usr/bin/env bash

source "$CONFIG_DIR/colors.sh"

# Runs on aerospace_workspace_change. Highlighting remains synchronous,
# app labels refresh asynchronously to avoid stalling AeroSpace during fast switches.

if [ "$SENDER" != "aerospace_workspace_change" ] && [ "$SENDER" != "forced" ]; then
  exit 0
fi

WORKSPACES=${WORKSPACES_OVERRIDE:-"1 2 3 4 5 6 7 8 9"}
FOCUSED="${AEROSPACE_FOCUSED_WORKSPACE:-}"

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
      icon.color=$ICON_COLOR
      icon.font="JetBrainsMono Nerd Font:Bold:16.0"
      label.color=0xffbb9af7
      label.highlight=true
      # background.border_color=0xff2AC3DE
      background.border_color=0x00000000
      background.color=0xd0332f55
    )
  else
    highlight_args+=(
      --set "$item_name"
      icon.highlight=false
      icon.color=0xcc939BBD
      icon.font="JetBrainsMono Nerd Font:Regular:12.0"
      label.color=0xcc939BBD
      label.highlight=false
      background.border_color=0x00000000
      background.color=0x00000000
    )
  fi
done

if [ ${#highlight_args[@]} -gt 0 ]; then
  sketchybar "${highlight_args[@]}"
fi

# --- Async label refresh (slow path) ---

LOCK_DIR="${TMPDIR:-/tmp}/sketchybar_space_icons.lock"
if mkdir "$LOCK_DIR" 2>/dev/null; then
  (
    trap 'rmdir "$LOCK_DIR"' EXIT

    label_args=()
    for WORKSPACE_ID in $WORKSPACES; do
      apps=$(aerospace list-windows --workspace "$WORKSPACE_ID" 2>/dev/null | awk -F'|' '{gsub(/^ *| *$/, "", $2); print $2}')

      icon_strip=" "
      if [ -n "$apps" ]; then
        while read -r app_name; do
          [ -z "$app_name" ] && continue
          icon_strip+=" $("$CONFIG_DIR/plugins/icon_map.sh" "$app_name")"
        done <<<"$apps"
      else
        icon_strip=" —"
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
fi
