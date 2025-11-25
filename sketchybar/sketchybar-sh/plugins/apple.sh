#!/usr/bin/env bash

apple_logo=(
  icon=$APPLE
  icon.font="$FONT:Black:18.0"
  icon.color=$ICON_COLOR
  padding_right=5
  icon.padding_right=5
  label.padding_right=5
  padding_left=0
  label.drawing=off
  popup.height=35
)

apple_prefs=(
  icon=$PREFERENCES
  label="Settings"
  label.width=90
  padding_left=6
  padding_right=6
  icon.padding_left=6
  icon.padding_right=6
  label.padding_right=6
  background.corner_radius=4
  background.padding_left=6
  background.padding_right=6
  script="$PLUGIN_DIR/apple_hover.sh"
)

apple_activity=(
  icon=$ACTIVITY
  label="Activity"
  label.width=90
  padding_left=6
  padding_right=6
  icon.padding_left=6
  icon.padding_right=6
  label.padding_right=6
  background.corner_radius=4
  background.padding_left=6
  background.padding_right=6
  script="$PLUGIN_DIR/apple_hover.sh"
)

apple_lock=(
  icon=$LOCK
  label="Lock Screen"
  label.width=90
  padding_left=6
  padding_right=6
  icon.padding_left=6
  icon.padding_right=6
  label.padding_right=6
  background.corner_radius=4
  background.padding_left=6
  background.padding_right=6
  script="$PLUGIN_DIR/apple_hover.sh"
)

sketchybar --add item apple.logo left                 \
           --set apple.logo "${apple_logo[@]}"         \
                                                       \
           --add item apple.prefs popup.apple.logo     \
           --set apple.prefs "${apple_prefs[@]}"       \
           --subscribe apple.prefs mouse.entered mouse.exited mouse.exited.global \
                                                       \
           --add item apple.activity popup.apple.logo  \
           --set apple.activity "${apple_activity[@]}" \
           --subscribe apple.activity mouse.entered mouse.exited mouse.exited.global \
                                                       \
           --add item apple.lock popup.apple.logo      \
           --set apple.lock "${apple_lock[@]}"         \
           --subscribe apple.lock mouse.entered mouse.exited mouse.exited.global
