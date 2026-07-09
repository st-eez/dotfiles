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

# Every profile defaults to FFM off, but nothing else revives AutoRaise after
# toggle-ffm.sh killed it (the brew LaunchAgent has no KeepAlive) — without
# this, switching profiles out of FFM mode leaves NO hover engine running.
if grep -q '^focus-follows-mouse.enabled = false' "$conf/aerospace.toml"; then
  pgrep -q "AutoRaise" || /opt/homebrew/opt/autoraise/bin/AutoRaise &
fi
# Reload both consumers even when one fails: sketchybar must pick up the new
# sentinel while aerospace is crashed/restarting (hotplug bug
# nikitabobko/AeroSpace#506), but a failed reload-config must surface in the
# exit code so apply-profile.sh withholds convergence and its poll retries —
# otherwise aerospace keeps running the old profile while sentinel, converged,
# and aerospace.toml all claim the new one.
rc=0
aerospace reload-config || rc=$?
sketchybar --reload || true
exit "$rc"
