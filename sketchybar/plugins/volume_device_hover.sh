#!/usr/bin/env bash

source "$CONFIG_DIR/colors.sh"

HOVER_COLOR=0xd0332f55
BASE_BACKGROUND="${BASE_BACKGROUND:-0x00000000}"
BASE_LABEL="${BASE_LABEL:-$LABEL_COLOR}"

case "$SENDER" in
  mouse.entered)
    sketchybar --set "$NAME" background.color="$HOVER_COLOR"
    ;;
  mouse.exited)
    sketchybar --set "$NAME" background.color="$BASE_BACKGROUND" label.color="$BASE_LABEL"
    ;;
esac
