#!/usr/bin/env bash
# Build and (re)install the profile-watcher LaunchAgent. Idempotent.
#
# launchd does not create StandardOutPath parent dirs, and symlinked plists
# have a history of not bootstrapping reliably, so the plist is rendered and
# copied (not stowed) into ~/Library/LaunchAgents.

set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
dotfiles=$(dirname "$here")
label=com.steez.profile-watcher
plist="$HOME/Library/LaunchAgents/$label.plist"
uid=$(id -u)

make -C "$here"

mkdir -p "$HOME/Library/Logs/AeroSpace" "$HOME/Library/LaunchAgents"

stow --dir="$dotfiles" --target="$HOME" --no-folding --restow aerospace

sed "s|__HOME__|$HOME|g" "$here/$label.plist.template" >"$plist.tmp"
plutil -lint "$plist.tmp" >/dev/null
mv "$plist.tmp" "$plist"

launchctl bootout "gui/$uid/$label" 2>/dev/null || true
launchctl bootstrap "gui/$uid" "$plist"

sleep 1
launchctl print "gui/$uid/$label" | grep -E "^\s*(state|pid)" || {
    echo "agent failed to start — check ~/Library/Logs/AeroSpace/profile-watcher.agent.log" >&2
    exit 1
}
echo "profile-watcher installed and running"
