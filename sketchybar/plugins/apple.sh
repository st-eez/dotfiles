#!/usr/bin/env bash

POPUP_OFF='sketchybar --set apple.logo popup.drawing=off'
POPUP_CLICK_SCRIPT='sketchybar --set $NAME popup.drawing=toggle'

apple_logo=(
  icon=$APPLE
  icon.font="$FONT:Black:18.0"
  icon.color=$ICON_COLOR
  padding_right=5
  icon.padding_right=5
  label.padding_right=5
  padding_left=0
  label.drawing=off
  click_script="$POPUP_CLICK_SCRIPT"
  popup.height=35
)

apple_prefs=(
  icon=$PREFERENCES
  label="Preferences"
  label.width=90
  padding_left=6
  padding_right=6
  icon.padding_left=6
  icon.padding_right=6
  label.padding_right=6
  background.corner_radius=4
  background.padding_left=10
  background.padding_right=10
  script="$PLUGIN_DIR/apple_hover.sh"
  click_script="open -a 'System Preferences'; $POPUP_OFF"
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
  background.padding_left=10
  background.padding_right=10
  script="$PLUGIN_DIR/apple_hover.sh"
  click_script="open -a 'Activity Monitor'; $POPUP_OFF"
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
  background.padding_left=10
  background.padding_right=10
  script="$PLUGIN_DIR/apple_hover.sh"
  click_script="pmset displaysleepnow; $POPUP_OFF"
)

sketchybar --add item apple.logo left                 \
           --set apple.logo "${apple_logo[@]}"         \
                                                       \
           --add item apple.prefs popup.apple.logo     \
           --set apple.prefs "${apple_prefs[@]}"       \
           --subscribe apple.prefs mouse.entered mouse.exited \
                                                       \
           --add item apple.activity popup.apple.logo  \
           --set apple.activity "${apple_activity[@]}" \
           --subscribe apple.activity mouse.entered mouse.exited \
                                                       \
           --add item apple.lock popup.apple.logo      \
           --set apple.lock "${apple_lock[@]}"         \
           --subscribe apple.lock mouse.entered mouse.exited
