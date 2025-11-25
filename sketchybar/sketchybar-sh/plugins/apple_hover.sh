#!/usr/bin/env bash

# Handles hover visuals for Apple menu popup items

source "$CONFIG_DIR/colors.sh"

HIGHLIGHT_COLOR=$HIGHLIGHT_TINT

case "$SENDER" in
  mouse.entered)
    sketchybar --set "$NAME" background.color="$HIGHLIGHT_COLOR"
    ;;

  mouse.exited)
    sketchybar --set "$NAME" background.color="$TRANSPARENT"
    ;;

  mouse.exited.global)
    sketchybar --set "$NAME" background.color="$TRANSPARENT"
    sketchybar --set apple.logo popup.drawing=off
    ;;

  *)
    ;;
esac
