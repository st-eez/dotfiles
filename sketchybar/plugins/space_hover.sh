#!/usr/bin/env bash

# Handles hover visuals for workspace items.
# On hover, temporarily apply the highlight tint to the hovered workspace
# and remove it from the actual focused space so the tint follows the cursor.

source "$CONFIG_DIR/colors.sh"

WORKSPACES=${WORKSPACES_OVERRIDE:-"1 2 3 4 5 6 7 8 9"}
FOCUSED=$(aerospace list-workspaces --focused 2>/dev/null || echo "")

set_highlight() {
  local workspace_id=$1
  local color=$2

  sketchybar --set "space.$workspace_id" \
    background.color="$color"
}

# Default highlight color from space_windows.sh
HIGHLIGHT_COLOR=$HIGHLIGHT_TINT
TRANSPARENT_COLOR=$TRANSPARENT

case "$SENDER" in
  mouse.entered)
    HOVERED_ITEM="$NAME"
    HOVERED_ID=${HOVERED_ITEM#space.}

    # Remove tint from whichever space is currently focused
    if [ -n "$FOCUSED" ]; then
      set_highlight "$FOCUSED" "$TRANSPARENT_COLOR"
    fi

    # Apply tint to hovered space
    if [ -n "$HOVERED_ID" ]; then
      set_highlight "$HOVERED_ID" "$HIGHLIGHT_COLOR"
    fi
    ;;

  mouse.exited)
    HOVERED_ITEM="$NAME"
    HOVERED_ID=${HOVERED_ITEM#space.}

    # Clear tint from hovered item when leaving
    if [ -n "$HOVERED_ID" ]; then
      set_highlight "$HOVERED_ID" "$TRANSPARENT_COLOR"
    fi

    # Restore tint to the actual focused workspace
    if [ -n "$FOCUSED" ]; then
      set_highlight "$FOCUSED" "$HIGHLIGHT_COLOR"
    fi
    ;;

  *)
    # Ignore other events
    ;;
 esac
