#!/bin/bash
# Swap the hover-raise engine: native focus-follows-mouse <-> AutoRaise.
# Native FFM raises tree windows during macOS-native fullscreen (kills
# YouTube fullscreen; reproduced 2026-07-03), so AutoRaise is the default
# engine until that is fixed upstream. This chord enables FFM for testing
# newer AeroSpace builds and brings AutoRaise back when toggled again.
#
# Writes through the stow symlink via redirection — sed -i would replace the
# symlink with a regular file and break stow. State resets to the profile
# default (FFM off, AutoRaise on) on the next profile switch, since
# set-profile.sh re-copies the profile over aerospace.toml.
set -euo pipefail

conf="$HOME/.config/aerospace/aerospace.toml"
tmp=$(mktemp)

if grep -q '^focus-follows-mouse.enabled = true' "$conf"; then
    sed 's/^focus-follows-mouse.enabled = true/focus-follows-mouse.enabled = false/' "$conf" > "$tmp"
    engine="AutoRaise"
    pgrep -q "AutoRaise" || /Applications/AutoRaise.app/Contents/MacOS/AutoRaise &
else
    sed 's/^focus-follows-mouse.enabled = false/focus-follows-mouse.enabled = true/' "$conf" > "$tmp"
    engine="focus-follows-mouse"
    killall AutoRaise 2>/dev/null || true
fi

cat "$tmp" > "$conf"
rm -f "$tmp"

aerospace reload-config
osascript -e "display notification \"hover-raise engine: $engine\" with title \"AeroSpace\""
