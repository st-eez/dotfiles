#!/usr/bin/env bash

# Get current hidden state
current_state=$(sketchybar --query bar | grep -o '"hidden": "[^"]*"' | cut -d'"' -f4)

# Toggle the state
if [ "$current_state" = "off" ]; then
  # Hide sketchybar to reveal macOS menu bar
  sketchybar --bar hidden=on
  echo "SketchyBar: HIDDEN (macOS menu bar visible)"
else
  # Show sketchybar on top
  sketchybar --bar hidden=off topmost=on
  echo "SketchyBar: VISIBLE (on top of macOS menu bar)"
fi
