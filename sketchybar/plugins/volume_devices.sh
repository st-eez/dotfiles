#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOVER_SCRIPT="$SCRIPT_DIR/volume_device_hover.sh"
SELF_SCRIPT="$SCRIPT_DIR/volume_devices.sh"

source "$CONFIG_DIR/colors.sh"
source "$CONFIG_DIR/icons.sh"

FONT="JetBrainsMono Nerd Font"

command -v SwitchAudioSource >/dev/null 2>&1 || exit 0

CURRENT_DEVICE="$(SwitchAudioSource -t output -c 2>/dev/null)"
DEVICES="$(SwitchAudioSource -a -t output 2>/dev/null | grep -vE '(ASUS VA24E|LG ULTRAWIDE|Microsoft Teams Audio|BenQ XL2411Z|Pixio PX248PS)')"

INACTIVE_LABEL="$LABEL_COLOR"
INACTIVE_BACKGROUND=0x12000000
ACTIVE_LABEL="$WHITE"
ACTIVE_BACKGROUND=0x80332f55

# If called with --update-active, just update colors without rebuilding
if [ "$1" = "--update-active" ]; then
  COUNTER=0
  while IFS= read -r device; do
    [ -z "$device" ] && continue

    label_color="$INACTIVE_LABEL"
    background_color="$INACTIVE_BACKGROUND"
    if [ "$device" = "$CURRENT_DEVICE" ]; then
      label_color="$ACTIVE_LABEL"
      background_color="$ACTIVE_BACKGROUND"
    fi

    sketchybar --set volume.device.$COUNTER label.color="$label_color" \
                                           background.color="$background_color" \
                                           script="BASE_BACKGROUND=$background_color BASE_LABEL=$label_color $HOVER_SCRIPT"
    COUNTER=$((COUNTER + 1))
  done <<< "$DEVICES"
  exit 0
fi

args=(--remove '/volume.device\..*/' --remove volume.popup.settings)

COUNTER=0
while IFS= read -r device; do
  [ -z "$device" ] && continue

  label_color="$INACTIVE_LABEL"
  background_color="$INACTIVE_BACKGROUND"
  if [ "$device" = "$CURRENT_DEVICE" ]; then
    label_color="$ACTIVE_LABEL"
    background_color="$ACTIVE_BACKGROUND"
  fi

  args+=(--add item volume.device.$COUNTER popup.volume \
         --set volume.device.$COUNTER label="${device}" \
                                     label.color="$label_color" \
                                     label.font="$FONT:Regular:13.0" \
                                     label.width=180 \
                                     label.align=left \
                                     label.padding_left=12 \
                                     label.padding_right=12 \
                                     icon.drawing=off \
                                     padding_left=8 \
                                     padding_right=8 \
                                     background.corner_radius=8 \
                                     background.height=30 \
                                     background.padding_left=6 \
                                     background.padding_right=6 \
                                     background.color="$background_color" \
                                     script="BASE_BACKGROUND=$background_color BASE_LABEL=$label_color $HOVER_SCRIPT" \
               click_script="SwitchAudioSource -t output -s \"${device}\" && sleep 0.1 && $SELF_SCRIPT --update-active")
  args+=(--subscribe volume.device.$COUNTER mouse.entered mouse.exited mouse.exited.global)

  COUNTER=$((COUNTER + 1))
done <<< "$DEVICES"

sketchybar -m "${args[@]}" >/dev/null

# Add settings item at the end
sketchybar --add item volume.popup.settings popup.volume \
           --set volume.popup.settings \
                 icon="$PREFERENCES" \
                 icon.font="$FONT:Semibold:13.0" \
                 icon.color="$MAGENTA" \
                 label="Sound Settings" \
                 label.font="$FONT:Bold:13.0" \
                 label.color="$MAGENTA" \
                 label.align=left \
                 label.width=160 \
                 padding_left=6 \
                 padding_right=6 \
                 icon.padding_left=6 \
                 icon.padding_right=6 \
                 background.corner_radius=6 \
                 background.height=32 \
                 background.padding_left=8 \
                 background.padding_right=8 \
                 background.color=0x00000000 \
                 click_script="open 'x-apple.systempreferences:com.apple.preference.sound'" \
                 script="$SCRIPT_DIR/apple_hover.sh" \
           --subscribe volume.popup.settings mouse.entered mouse.exited
