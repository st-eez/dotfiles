#!/usr/bin/env bash

source "$CONFIG_DIR/icons.sh"
source "$CONFIG_DIR/colors.sh"

# Get the active network interface
ACTIVE_INTERFACE=$(scutil --nwi | grep -m1 'Network interfaces:' | awk '{print $3}')

if [ -z "$ACTIVE_INTERFACE" ]; then
  # No network connection
  ICON="$WIFI_DISCONNECTED"
  ICON_SIZE="14.0"
else
  # Check if it's WiFi (en0) or Ethernet
  INTERFACE_TYPE=$(networksetup -listallhardwareports | grep -B1 "Device: $ACTIVE_INTERFACE" | grep "Hardware Port:" | awk -F': ' '{print $2}')

  if echo "$INTERFACE_TYPE" | grep -qi "wi-fi\|airport"; then
    # WiFi connection
    ICON="$WIFI_CONNECTED"
    ICON_SIZE="14.0"
  else
    # Ethernet connection
    ICON="$ETHERNET_CONNECTED"
    ICON_SIZE="18.0"
  fi
fi

sketchybar --set "$NAME" icon="$ICON" icon.font.size="$ICON_SIZE" icon.color="$ICON_COLOR"
