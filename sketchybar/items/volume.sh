#!/bin/sh

volume=(
  script="$PLUGIN_DIR/volume.sh"
  padding_left=3
  padding_right=3
  icon.font="$FONT:Regular:14.0"
  icon.padding_left=8
  icon.padding_right=8
  label.drawing=off
)

sketchybar --add item volume right         \
           --set volume "${volume[@]}"     \
           --subscribe volume volume_change

sketchybar --add bracket status calendar battery wifi volume \
           --set status background.drawing=off

