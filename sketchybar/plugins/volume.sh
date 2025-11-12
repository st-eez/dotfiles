#!/usr/bin/env bash

source "$CONFIG_DIR/icons.sh"
source "$CONFIG_DIR/colors.sh"

HIGHLIGHT_COLOR=0xd0332f55
TRANSPARENT=0x00000000

case "$SENDER" in
  "volume_change")
    case $INFO in
      [6-9][0-9]|100) ICON=$VOLUME_100
      ;;
      [3-5][0-9]) ICON=$VOLUME_66
      ;;
      [1-2][0-9]) ICON=$VOLUME_33
      ;;
      [1-9]) ICON=$VOLUME_10
      ;;
      0) ICON=$VOLUME_0
      ;;
      *) ICON=$VOLUME_100
    esac
    sketchybar --set "$NAME" icon="$ICON" icon.color="$ICON_COLOR"
    ;;

  "mouse.entered")
    sketchybar --set "$NAME" background.color="$HIGHLIGHT_COLOR"
    ;;

  "mouse.exited")
    sketchybar --set "$NAME" background.color="$TRANSPARENT"
    ;;
esac
