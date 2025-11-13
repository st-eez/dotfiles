#!/usr/bin/env bash

BATTERY_CLICK='osascript -e "tell application \"System Events\" to tell process \"ControlCenter\" to click menu bar item 1 of menu bar 1"'
CONTROL_CENTER_CLICK='osascript -e "tell application \"System Events\" to tell process \"ControlCenter\" to click menu bar item 4 of menu bar 1"'

sketchybar --remove "Control Center,ControlCenter"

control_center=(
  icon="􀜊"
  icon.font="$FONT:Regular:16.0"
  icon.color=$ICON_COLOR
  icon.padding_left=8
  icon.padding_right=8
  label.drawing=off
  padding_left=0
  padding_right=0
  click_script="$CONTROL_CENTER_CLICK"
)

sketchybar --add item control_center right \
           --set control_center "${control_center[@]}"

sketchybar --add alias "Control Center,Battery" right \
           --set "Control Center,Battery" alias.color=$ICON_COLOR \
                  padding_left=0 \
                  padding_right=0 \
                  icon.padding_left=0 \
                  icon.padding_right=0 \
                  label.padding_left=0 \
                  label.padding_right=0 \
                  click_script="$BATTERY_CLICK"
