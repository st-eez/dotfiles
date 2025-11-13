#!/usr/bin/env bash

source "$CONFIG_DIR/icons.sh"
source "$CONFIG_DIR/colors.sh"

HIGHLIGHT_COLOR="${BG1:-0xff332f55}"
TRANSPARENT_COLOR="${TRANSPARENT:-0x00000000}"

set_wifi_icon() {
  local active_interface icon icon_size interface_type

  active_interface=$(scutil --nwi | grep -m1 'Network interfaces:' | awk '{print $3}')

  if [ -z "$active_interface" ]; then
    icon="$WIFI_DISCONNECTED"
    icon_size="14.0"
  else
    interface_type=$(networksetup -listallhardwareports | grep -B1 "Device: $active_interface" | grep "Hardware Port:" | awk -F': ' '{print $2}')

    if echo "$interface_type" | grep -qi "wi-fi\|airport"; then
      icon="$WIFI_CONNECTED"
      icon_size="14.0"
    else
      icon="$WIFI_CONNECTED"
      icon_size="14.0"
    fi
  fi

  sketchybar --set "$NAME" \
             icon="$icon" \
             icon.font.size="$icon_size" \
             icon.color="$ICON_COLOR"
}

case "$SENDER" in
  mouse.entered)
    sketchybar --set "$NAME" background.color="$HIGHLIGHT_COLOR"
    ;;
  mouse.exited)
    sketchybar --set "$NAME" background.color="$TRANSPARENT_COLOR"
    ;;
  *)
    set_wifi_icon
    ;;
esac
