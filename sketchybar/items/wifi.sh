#!/usr/bin/env bash

wifi=(
  script="$PLUGIN_DIR/wifi.sh"
  padding_left=3
  padding_right=3
  icon.font="$FONT:Regular:14.0"
  icon.padding_left=8
  icon.padding_right=8
  label.drawing=off
)

sketchybar --add item wifi right \
           --set wifi "${wifi[@]}"
