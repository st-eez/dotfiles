#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOVER_SCRIPT="$SCRIPT_DIR/volume_device_hover.sh"
SELF_SCRIPT="$SCRIPT_DIR/volume_devices.sh"

source "$CONFIG_DIR/colors.sh"

FONT="JetBrainsMono Nerd Font"

command -v SwitchAudioSource >/dev/null 2>&1 || exit 0

CURRENT_DEVICE="$(SwitchAudioSource -t output -c 2>/dev/null)"
DEVICES="$(SwitchAudioSource -a -t output 2>/dev/null)"

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

args=(--remove '/volume.device\..*/')

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
               click_script="SwitchAudioSource -s \"${device}\" && sleep 0.1 && $SELF_SCRIPT --update-active")
  args+=(--subscribe volume.device.$COUNTER mouse.entered mouse.exited)

  COUNTER=$((COUNTER + 1))
done <<< "$DEVICES"

sketchybar -m "${args[@]}" >/dev/null
