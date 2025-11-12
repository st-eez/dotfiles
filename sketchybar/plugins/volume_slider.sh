#!/usr/bin/env bash

current_volume() {
  osascript -e 'output volume of (get volume settings)' 2>/dev/null || echo 0
}

case "$SENDER" in
  "mouse.clicked")
    if [ -n "$PERCENTAGE" ]; then
      osascript -e "set volume output volume ${PERCENTAGE}" >/dev/null
      sketchybar --set "$NAME" slider.percentage="$PERCENTAGE"
      exit 0
    fi
    ;;
  "volume_change")
    if [ -n "$INFO" ]; then
      sketchybar --set "$NAME" slider.percentage="$INFO"
      exit 0
    fi
    ;;
esac

sketchybar --set "$NAME" slider.percentage="$(current_volume)"
