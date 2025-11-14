#!/usr/bin/env bash

# Shared Wi-Fi helpers so status scripts stay in sync.

get_wifi_device() {
  networksetup -listallhardwareports 2>/dev/null | \
    awk '/Hardware Port: (Wi-Fi|AirPort)/{getline; sub(/^Device: /,""); print; exit}'
}

get_wifi_power_state() {
  local device="$1"
  [ -z "$device" ] && { echo "missing"; return 1; }

  local state
  state=$(networksetup -getairportpower "$device" 2>/dev/null | awk '{print tolower($NF)}')

  case "$state" in
    on|off) echo "$state" ;;
    *) echo "unknown"; return 1 ;;
  esac
}
