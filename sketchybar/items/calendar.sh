#!/usr/bin/env bash

calendar=(
  icon.drawing=on
  icon.font="$FONT:Bold:13.0"
  icon.padding_left=8
  icon.padding_right=8
  label.font="$FONT:Bold:13.0"
  label.align=right
  label.padding_left=0
  label.padding_right=6
  padding_left=3
  padding_right=3
  update_freq=30
  script="$PLUGIN_DIR/calendar.sh"
  click_script="$PLUGIN_DIR/zen.sh"
)

sketchybar --add item calendar right       \
           --set calendar "${calendar[@]}" \
           --subscribe calendar system_woke
