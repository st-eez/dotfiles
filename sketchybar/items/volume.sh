#!/usr/bin/env bash

POPUP_TOGGLE="$PLUGIN_DIR/volume_devices.sh; sketchybar --set \$NAME popup.drawing=toggle"
CURRENT_VOLUME="$(osascript -e 'output volume of (get volume settings)' 2>/dev/null || echo 0)"

volume=(
  script="$PLUGIN_DIR/volume.sh"
  click_script="$POPUP_TOGGLE"
  padding_left=0
  padding_right=0
  icon.font="$FONT:Regular:16.0"
  icon.width=38
  icon.padding_left=8
  icon.padding_right=0
  label.drawing=off
  popup.align=center
  background.color=$TRANSPARENT
  background.corner_radius=8
  background.height=26
  background.padding_left=2
  background.padding_right=2
)

volume_slider=(
  script="$PLUGIN_DIR/volume_slider.sh"
  slider.percentage="$CURRENT_VOLUME"
  slider.width=160
  slider.highlight_color=$ICON_COLOR
  slider.background.color=$BG1
  slider.background.height=6
  slider.background.corner_radius=3
  slider.knob="⬤"
  slider.knob.font="$FONT:Bold:30.0"
  slider.knob.color=$ICON_COLOR
  slider.knob.drawing=on
  label.drawing=off
  icon.drawing=off
  padding_left=14
  padding_right=14
)

sketchybar --add item volume right \
           --set volume "${volume[@]}" \
           --subscribe volume volume_change mouse.entered mouse.exited

sketchybar --add slider volume.popup.slider popup.volume \
           --set volume.popup.slider "${volume_slider[@]}" \
           --subscribe volume.popup.slider mouse.clicked volume_change mouse.exited.global

"$PLUGIN_DIR/volume_devices.sh"

TEAMS_CLICK='osascript -e "tell application \"System Events\" to tell process \"MSTeams\" to click menu bar item 1 of menu bar 2"'

sketchybar --add alias "Control Center,com.microsoft.teams2" right \
           --set "Control Center,com.microsoft.teams2" alias.color=$ICON_COLOR \
                  click_script="$TEAMS_CLICK"

sketchybar --add bracket status calendar control_center "Control Center,Battery" wifi volume "Control Center,com.microsoft.teams2" \
           --set status background.drawing=off
