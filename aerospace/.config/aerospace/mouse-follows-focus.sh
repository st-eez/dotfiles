#!/bin/bash
# Mouse lazily follows focus — but only for focus changes the mouse didn't
# cause. Fired by on-focus-changed (window), on-focused-monitor-changed
# (monitor), and exec-on-workspace-change (workspace).
#
# Why the guard exists (reproduced 2026-07-08): hover-raising window B of a
# two-window app (Discord on two monitors) makes AutoRaise AXRaise(B) then
# activate the whole app; the activation lands before Electron has processed
# the raise, so macOS fronts the app's remembered key window A instead.
# AeroSpace adopts A and fires these movers, which used to warp the cursor
# to A's monitor — AutoRaise then hover-raised A, cancelling its own pending
# B re-raises (raiseTimes) and making the steal permanent. Left unwarped,
# AutoRaise's retry loop re-raises B within ~150ms and the flicker is
# invisible. So: a focus change while the hand is on the mouse never warps.
#
# Guard mechanics:
# - mff-probe reports seconds since the last mouse move in the HID event
#   state. Real input counts; so do the synthetic .mouseMoved events that
#   aerospace move-mouse posts — our own executed warps are therefore
#   timestamped in $STATE and excluded, or else the first warp of a rapid
#   keyboard chain (alt-l alt-l) would suppress the rest. AutoRaise can't
#   raise off our warps: they always land inside the already-focused window.
# - AEROSPACE_WINDOW_ID/AEROSPACE_WORKSPACE are scrubbed before move-mouse:
#   exec-and-forget pins the triggering event's window into the env and the
#   CLI prefers it over live focus, so an unscrubbed mover warps to the
#   stale pre-correction window even after focus has self-healed.
# - The 50ms settle lets the WindowServer finish swapping frames — warping
#   onto a not-yet-parked window makes AutoRaise raise it and flip the
#   workspace right back.
# - move-mouse stays round-tripped through the CLI (in-process it would run
#   pre-layout and read parked hide-corner rects) and stays LAZY (a forced
#   center would teleport the cursor on old click-initiated focus changes).
# - Fails open: without probe binary and swiftc, behave like the pre-guard
#   config and always move.
set -u

AERO=/opt/homebrew/bin/aerospace
PROBE="$HOME/.local/bin/mff-probe"
PROBE_SRC="$HOME/.config/aerospace/mff-probe.swift"
STATE="$HOME/.cache/aerospace/mff-last-warp"
MOUSE_ACTIVE_SECS=0.6 # covers AutoRaise raise latency + Electron steal lag + our 50ms settle
OWN_WARP_SLOP=0.15    # |last HID event - our recorded warp| below this = the event was ours

/bin/sleep 0.05

if [[ ! -x $PROBE && -r $PROBE_SRC ]] && command -v swiftc >/dev/null; then
    tmp=$(mktemp -d)
    swiftc -O -o "$tmp/mff-probe" "$PROBE_SRC" 2>/dev/null &&
        mkdir -p "$(dirname "$PROBE")" &&
        mv "$tmp/mff-probe" "$PROBE"
    rm -rf "$tmp"
fi

before=$("$PROBE" 2>/dev/null) || before=""
if [[ -n $before ]]; then
    read -r now idle x y <<<"$before"
    last_warp=$(cat "$STATE" 2>/dev/null || echo 0)
    if awk -v now="$now" -v idle="$idle" -v warp="$last_warp" \
        -v active="$MOUSE_ACTIVE_SECS" -v slop="$OWN_WARP_SLOP" \
        'BEGIN { d = (now - idle) - warp; if (d < 0) d = -d; exit !(idle < active && d > slop) }'; then
        exit 0 # recent movement that is not our own warp: the hand is on the mouse
    fi
fi

move() { env -u AEROSPACE_WINDOW_ID -u AEROSPACE_WORKSPACE "$AERO" move-mouse "$@"; }

case ${1:-} in
window) move window-lazy-center ;;
monitor) move monitor-lazy-center ;;
# window-lazy-center covers populated workspaces; the monitor-force-center
# fallback covers empty ones, where nothing else pulls the cursor off the
# hide-corner slivers.
workspace) move window-lazy-center || move monitor-force-center ;;
*)
    echo "usage: $0 window|monitor|workspace" >&2
    exit 2
    ;;
esac

# Timestamp executed warps (lazy no-ops post no event and don't count).
if [[ -n $before ]]; then
    after=$("$PROBE" 2>/dev/null) || exit 0
    read -r now2 _ x2 y2 <<<"$after"
    if [[ $x2 != "$x" || $y2 != "$y" ]]; then
        mkdir -p "$(dirname "$STATE")"
        printf '%s\n' "$now2" >"$STATE"
    fi
fi
