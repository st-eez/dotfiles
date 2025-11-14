#!/usr/bin/env bash

source "$CONFIG_DIR/icons.sh"
source "$CONFIG_DIR/colors.sh"
source "$CONFIG_DIR/plugins/wifi_common.sh"

set_wifi_icon() {
  local active_interface interface_type icon icon_size

  active_interface=$(scutil --nwi | grep -m1 'Network interfaces:' | awk '{print $3}')
  icon_size="14.0"

  if [ -n "$active_interface" ]; then
    interface_type=$(networksetup -listallhardwareports | grep -B1 "Device: $active_interface" | grep "Hardware Port:" | awk -F': ' '{print $2}')

    icon="$WIFI_CONNECTED"
  else
    local wifi_device wifi_power
    wifi_device="$(get_wifi_device)"
    wifi_power="$(get_wifi_power_state "$wifi_device")"

    if [ "$wifi_power" = "off" ] || [ "$wifi_power" = "missing" ]; then
      icon="$WIFI_DISCONNECTED"
    else
      icon="$WIFI_DISCONNECTED"
    fi
  fi

  sketchybar --set "$NAME" \
             icon="$icon" \
             icon.font.size="$icon_size" \
             icon.color="$ICON_COLOR"
}

case "$SENDER" in
  mouse.entered|mouse.exited)
    # No highlight changes; just ignore these events
    ;;
  *)
    set_wifi_icon
    ;;
esac
