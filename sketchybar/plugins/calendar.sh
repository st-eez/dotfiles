#!/bin/bash

# Split date and time for precise spacing control
DATE=$(date '+%a %b %d')
TIME=$(date '+%I:%M %p')
# Remove leading zero from hour
TIME=${TIME#0}
# Remove space before AM/PM
TIME=${TIME// /}

# Set both icon (date) and label (time)
sketchybar --set "$NAME" icon="$DATE" label="$TIME"