#!/usr/bin/env bash
# Swap to an aerospace profile: home | office | laptop.
# Single source of truth for profile switching — writes a sentinel that
# sketchybar reads to decide between 5-workspace (laptop) and 10-workspace layouts.
set -eu

PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

profile=${1:?usage: set-profile.sh home|office|laptop}
conf=$HOME/.config/aerospace
target=$conf/aerospace-$profile.toml

[ -f "$target" ] || { echo "no such profile: $profile" >&2; exit 1; }

# Move windows off 6-0 before laptop's 5-workspace layout hides them.
if [ "$profile" = laptop ]; then
  "$conf/migrate-to-laptop.sh"
fi

cp "$target" "$conf/aerospace.toml"
printf '%s' "$profile" > "$conf/.active-profile"
aerospace reload-config
sketchybar --reload
