#!/usr/bin/env bash

# Handles hover visuals for Apple menu popup items

source "$CONFIG_DIR/colors.sh"

HIGHLIGHT_COLOR=0xd0332f55
TRANSPARENT=0x00000000

case "$SENDER" in
  mouse.entered)
    sketchybar --set "$NAME" background.color="$HIGHLIGHT_COLOR"
    ;;

  mouse.exited)
    sketchybar --set "$NAME" background.color="$TRANSPARENT"
    ;;

  *)
    ;;
esac
