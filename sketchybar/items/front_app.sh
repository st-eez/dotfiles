#!/bin/sh

front_app=(
  label.font="$FONT:Bold:13.0"
  icon.background.drawing=on
  icon.padding_right=6
  display=active
  script="$PLUGIN_DIR/front_app.sh"
  click_script="open -a 'Mission Control'"
)
sketchybar --add item front_app left         \
           --set front_app "${front_app[@]}" \
           --subscribe front_app front_app_switched
