#!/usr/bin/env bash

POPUP_CONTROLLER="$PLUGIN_DIR/wifi_popup.sh"
POPUP_CLICK_SCRIPT="$POPUP_CONTROLLER --toggle-popup"
WIFI_POWER_TOGGLE="$POPUP_CONTROLLER --toggle-wifi"

wifi=(
  script="$PLUGIN_DIR/wifi.sh"
  click_script="$POPUP_CLICK_SCRIPT"
  padding_left=3
  padding_right=3
  icon.font="$FONT:Regular:14.0"
  icon.width=38
  icon.padding_left=8
  icon.padding_right=8
  label.drawing=off
  popup.align=center
  background.color=0x00000000
  background.corner_radius=8
  background.height=26
  background.width=38
  background.padding_left=2
  background.padding_right=2
)
wifi_popup_toggle=(
  icon="$WIFI_DISCONNECTED"
  icon.font="$FONT:Semibold:13.0"
  label="Wi-Fi"
  label.align=left
  label.width=120
  padding_left=6
  padding_right=6
  icon.padding_left=6
  icon.padding_right=6
  background.corner_radius=6
  background.height=32
  background.padding_left=8
  background.padding_right=8
  background.color=0x00000000
  click_script="$WIFI_POWER_TOGGLE"
  script="$POPUP_CONTROLLER"
)

wifi_popup_info=(
  icon.drawing=off
  label="Connected: Wi-Fi"
  label.font="$FONT:Regular:12.0"
  label.color="$LABEL_COLOR"
  label.align=left
  label.width=120
  label.padding_left=8
  padding_left=6
  padding_right=6
  background.height=24
  background.padding_left=8
  background.padding_right=8
  background.color=0x00000000
  script="$POPUP_CONTROLLER"
)

wifi_popup_settings=(
  icon="$PREFERENCES"
  icon.font="$FONT:Semibold:13.0"
  icon.color="$MAGENTA"
  label="Wi-Fi Settings"
  label.font="$FONT:Bold:13.0"
  label.color="$MAGENTA"
  label.align=left
  label.width=120
  padding_left=6
  padding_right=6
  icon.padding_left=6
  icon.padding_right=6
  background.corner_radius=6
  background.height=32
  background.padding_left=8
  background.padding_right=8
  background.color=0x00000000
  click_script="open 'x-apple.systempreferences:com.apple.wifi-settings-extension'"
  script="$POPUP_CONTROLLER"
)

sketchybar --add item wifi right \
           --set wifi "${wifi[@]}" \
           --subscribe wifi wifi_change mouse.entered mouse.exited

sketchybar --add item wifi.popup.toggle popup.wifi \
           --set wifi.popup.toggle "${wifi_popup_toggle[@]}" \
           --subscribe wifi.popup.toggle mouse.entered mouse.exited mouse.exited.global \
           --add item wifi.popup.info popup.wifi \
           --set wifi.popup.info "${wifi_popup_info[@]}" \
           --add item wifi.popup.settings popup.wifi \
           --set wifi.popup.settings "${wifi_popup_settings[@]}" \
           --subscribe wifi.popup.settings mouse.entered mouse.exited mouse.exited.global

"$POPUP_CONTROLLER" --refresh >/dev/null 2>&1 &
