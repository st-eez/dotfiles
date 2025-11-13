#!/usr/bin/env bash

CONFIG_DIR="${CONFIG_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PLUGIN_DIR="${PLUGIN_DIR:-$CONFIG_DIR/plugins}"

source "$CONFIG_DIR/colors.sh"
source "$CONFIG_DIR/icons.sh"
POPUP_PARENT="wifi"
TOGGLE_ITEM="wifi.popup.toggle"

ACTIVE_BG="${BG1:-0xff332f55}"
INACTIVE_BG="${TRANSPARENT:-0x00000000}"
BUSY_ICON="$LOADING"

toggle_popup() {
  refresh_popup
  sketchybar --set "$POPUP_PARENT" popup.drawing=toggle
}

close_popup() {
  sketchybar --set "$POPUP_PARENT" popup.drawing=off
}

handle_mouse_event() {
  case "$SENDER" in
    mouse.entered|mouse.exited)
      "$PLUGIN_DIR/apple_hover.sh"
      ;;
    mouse.exited.global)
      close_popup
      ;;
    *)
      return 1
      ;;
  esac

  exit 0
}

if [ "$#" -eq 0 ] && [ -n "$SENDER" ]; then
  handle_mouse_event
fi

get_wifi_device() {
  networksetup -listallhardwareports 2>/dev/null | \
    awk '/Hardware Port: (Wi-Fi|AirPort)/{getline; sub(/^Device: /,"" ); print; exit}'
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

get_connection_type() {
  local active_interface interface_type

  active_interface=$(scutil --nwi | grep -m1 'Network interfaces:' | awk '{print $3}')

  if [ -z "$active_interface" ]; then
    echo "Disconnected"
    return
  fi

  interface_type=$(networksetup -listallhardwareports | grep -B1 "Device: $active_interface" | grep "Hardware Port:" | awk -F': ' '{print $2}')

  if echo "$interface_type" | grep -qi "wi-fi\|airport"; then
    echo "Wi-Fi"
  else
    echo "Eth"
  fi
}

set_connection_info() {
  local connection_type
  connection_type="$(get_connection_type)"

  sketchybar --set wifi.popup.info label="Connected: $connection_type"
}

set_toggle_visuals() {
  local state="$1"
  local icon="$WIFI_DISCONNECTED"
  local label="Wi-Fi Off"
  local icon_color="${RED:-0xfffc5d7c}"
  local label_color="${RED:-0xfffc5d7c}"
  local background="$INACTIVE_BG"

  case "$state" in
    on)
      icon="$WIFI_CONNECTED"
      label="Wi-Fi On"
      icon_color="${GREEN:-0xff9ece6a}"
      label_color="${GREEN:-0xff9ece6a}"
      background="$INACTIVE_BG"
      ;;
    off)
      icon="$WIFI_DISCONNECTED"
      label="Wi-Fi Off"
      icon_color="${RED:-0xfffc5d7c}"
      label_color="${RED:-0xfffc5d7c}"
      ;;
    missing)
      icon="$WIFI_DISCONNECTED"
      label="Wi-Fi hardware missing"
      icon_color="${RED:-0xfffc5d7c}"
      label_color="${RED:-0xfffc5d7c}"
      ;;
    *)
      icon="$WIFI_DISCONNECTED"
      label="Wi-Fi unavailable"
      icon_color="${YELLOW:-0xffe7c664}"
      label_color="${YELLOW:-0xffe7c664}"
      ;;
  esac

  sketchybar --set "$TOGGLE_ITEM" \
             icon="$icon" \
             icon.color="$icon_color" \
             label="$label" \
             label.color="$label_color" \
             background.color="$background"
}

refresh_popup() {
  local device state
  device="$(get_wifi_device)"

  if [ -z "$device" ]; then
    state="missing"
  else
    state="$(get_wifi_power_state "$device")"
  fi

  set_toggle_visuals "$state"
  set_connection_info
}

trigger_wifi_item_refresh() {
  [ -z "$PLUGIN_DIR" ] && return
  NAME="wifi" "$PLUGIN_DIR/wifi.sh" >/dev/null 2>&1 &
}

toggle_wifi() {
  local device state target action_label
  device="$(get_wifi_device)"

  if [ -z "$device" ]; then
    set_toggle_visuals "missing"
    return 1
  fi

  state="$(get_wifi_power_state "$device")"
  case "$state" in
    on)  target="off" ;;
    off) target="on" ;;
    *)   target="on" ;;
  esac

  if [ "$target" = "on" ]; then
    action_label="Turning Wi-Fi On..."
  else
    action_label="Turning Wi-Fi Off..."
  fi

  sketchybar --set "$TOGGLE_ITEM" \
             icon="$BUSY_ICON" \
             icon.color="${ICON_COLOR:-0xff939BBD}" \
             label="$action_label" \
             label.color="${ICON_COLOR:-0xff939BBD}"

  if ! networksetup -setairportpower "$device" "$target" >/dev/null 2>&1; then
    sketchybar --set "$TOGGLE_ITEM" \
               icon="$WIFI_DISCONNECTED" \
               icon.color="${RED:-0xfffc5d7c}" \
               label="Toggle failed" \
               label.color="${RED:-0xfffc5d7c}"
    return 1
  fi

  sleep 0.2
  refresh_popup
  trigger_wifi_item_refresh
}

case "$1" in
  --toggle-popup)
    toggle_popup
    ;;
  --close-popup)
    close_popup
    ;;
  --refresh)
    refresh_popup
    ;;
  --toggle-wifi)
    toggle_wifi
    ;;
  *)
    ;;
esac

exit 0
