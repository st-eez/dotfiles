#!/usr/bin/env bash

volume=(
  script="$PLUGIN_DIR/volume.sh"
  padding_left=0
  padding_right=0
  icon.font="$FONT:Regular:16.0"
  icon.width=38
  icon.padding_left=8
  icon.padding_right=0
  label.drawing=off
  background.color=$TRANSPARENT
  background.corner_radius=8
  background.height=26
  background.padding_left=2
  background.padding_right=2
)

sketchybar --add item volume right \
           --set volume "${volume[@]}" \
           --subscribe volume volume_change

sketchybar --add alias "Control Center,com.microsoft.teams2" right \
           --set "Control Center,com.microsoft.teams2" alias.color=$ICON_COLOR \

sketchybar --add bracket status calendar control_center "Control Center,Battery" wifi volume "Control Center,com.microsoft.teams2" \
           --set status background.drawing=off
