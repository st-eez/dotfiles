#!/usr/bin/env bash

battery=(
  script="$PLUGIN_DIR/battery.sh"
  icon.font="$FONT:Regular:19.0"
  icon.padding_left=8
  icon.padding_right=8
  padding_right=3
  padding_left=3
  label.drawing=on  # Enable label to display the percentage
  label.font="$FONT:Regular:12.0"  # Slightly smaller percentage label
  update_freq=120
  updates=on
)

sketchybar --add item battery right \
           --set battery "${battery[@]}" \
              icon.font.size=15 update_freq=120 script="$PLUGIN_DIR/battery.sh" \
           --subscribe battery power_source_change system_woke
