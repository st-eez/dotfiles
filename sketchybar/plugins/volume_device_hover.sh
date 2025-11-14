#!/usr/bin/env bash

source "$CONFIG_DIR/colors.sh"

HOVER_COLOR=$HIGHLIGHT_TINT
BASE_BACKGROUND="${BASE_BACKGROUND:-$TRANSPARENT}"
BASE_LABEL="${BASE_LABEL:-$LABEL_COLOR}"

case "$SENDER" in
  mouse.entered)
    sketchybar --set "$NAME" background.color="$HOVER_COLOR"
    ;;
  mouse.exited)
    sketchybar --set "$NAME" background.color="$BASE_BACKGROUND" label.color="$BASE_LABEL"
    ;;
  mouse.exited.global)
    sketchybar --set "$NAME" background.color="$BASE_BACKGROUND" label.color="$BASE_LABEL"
    sketchybar --set volume popup.drawing=off
    ;;
esac
