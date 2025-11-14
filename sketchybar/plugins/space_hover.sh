#!/usr/bin/env bash

# Handles hover visuals for workspace items.
# On hover, apply a temporary highlight to the hovered workspace without touching the focused highlight.

source "$CONFIG_DIR/colors.sh"

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
    # Apply tint to hovered space
    set_highlight "${NAME#space.}" "$HIGHLIGHT_COLOR"
    ;;

  mouse.exited)
    HOVERED_ID=${NAME#space.}
    FOCUSED=$(sketchybar --query aerospace_workspace_controller 2>/dev/null | jq -r '.label.value // empty')

    # Only remove highlight if the hovered space is not the focused one
    if [ "$HOVERED_ID" != "$FOCUSED" ]; then
      set_highlight "$HOVERED_ID" "$TRANSPARENT_COLOR"
    fi
    ;;

  *)
    # Ignore other events
    ;;
esac

