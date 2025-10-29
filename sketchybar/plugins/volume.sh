#!/bin/bash

source "$CONFIG_DIR/icons.sh"
source "$CONFIG_DIR/colors.sh"

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
