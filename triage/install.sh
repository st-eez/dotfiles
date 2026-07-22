#!/usr/bin/env bash
# Install the beads-triage LaunchAgent and the `triage` CLI. Idempotent.
#
# Same rationale as profile-watcher: launchd does not create log parent
# dirs, and symlinked plists bootstrap unreliably, so the plist is
# rendered and copied (not stowed) into ~/Library/LaunchAgents.

set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
label=com.steez.beads-triage
plist="$HOME/Library/LaunchAgents/$label.plist"
uid=$(id -u)

mkdir -p "$HOME/.local/bin" "$HOME/Library/LaunchAgents"
chmod +x "$here/bin/triage"
ln -sfn "$here/bin/triage" "$HOME/.local/bin/triage"

sed "s|__HOME__|$HOME|g" "$here/$label.plist.template" >"$plist.tmp"
plutil -lint "$plist.tmp" >/dev/null
mv "$plist.tmp" "$plist"

launchctl bootout "gui/$uid/$label" 2>/dev/null || true
launchctl bootstrap "gui/$uid" "$plist"

launchctl print "gui/$uid/$label" >/dev/null || {
    echo "agent failed to load — check ~/Library/Logs/beads-triage.log" >&2
    exit 1
}
echo "beads-triage installed: Mondays 09:00 (runs on wake if asleep); manual: triage"
