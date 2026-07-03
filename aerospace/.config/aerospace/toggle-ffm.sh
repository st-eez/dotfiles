#!/bin/bash
# Toggle focus-follows-mouse in the ACTIVE config and reload.
# Replaces the old AutoRaise toggle (ctrl-alt-a).
#
# Writes through the stow symlink via redirection — sed -i would replace the
# symlink with a regular file and break stow. State resets to the profile
# default (enabled) on the next profile switch, since set-profile.sh re-copies
# the profile over aerospace.toml.
set -euo pipefail

conf="$HOME/.config/aerospace/aerospace.toml"
tmp=$(mktemp)

if grep -q '^focus-follows-mouse.enabled = true' "$conf"; then
    sed 's/^focus-follows-mouse.enabled = true/focus-follows-mouse.enabled = false/' "$conf" > "$tmp"
    state="off"
else
    sed 's/^focus-follows-mouse.enabled = false/focus-follows-mouse.enabled = true/' "$conf" > "$tmp"
    state="on"
fi

cat "$tmp" > "$conf"
rm -f "$tmp"

aerospace reload-config
osascript -e "display notification \"focus-follows-mouse: $state\" with title \"AeroSpace\""
