#!/usr/bin/env bash

source "$CONFIG_DIR/icons.sh"
source "$CONFIG_DIR/colors.sh"

AIRPODS_ICON="􁄡"

is_airpods_connected() {
  if command -v SwitchAudioSource >/dev/null 2>&1; then
    local current_device
    current_device="$(SwitchAudioSource -t output -c 2>/dev/null)"
    [[ "$current_device" =~ AirPods ]]
  else
    return 1
  fi
}

case "$SENDER" in
  "volume_change")
    if is_airpods_connected; then
      ICON="$AIRPODS_ICON"
    else
      case $INFO in
        [6-9][0-9]|100) ICON=$VOLUME_100
        ;;
        [3-5][0-9]) ICON=$VOLUME_66
        ;;
        [1-2][0-9]) ICON=$VOLUME_33
        ;;
        [1-9]) ICON=$VOLUME_10
        ;;
        0) ICON=$VOLUME_0
        ;;
        *) ICON=$VOLUME_100
      esac
    fi
    sketchybar --set "$NAME" icon="$ICON" icon.color="$ICON_COLOR"
    ;;

  "mouse.entered"|"mouse.exited")
    # Leave background untouched so no highlight effect
    ;;
esac
