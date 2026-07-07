#!/usr/bin/env bash
# apply-profile.sh — monitor-set -> aerospace profile reconciler.
#
# Trigger-agnostic and idempotent: launched by the profile-watcher LaunchAgent
# (display events, startup sync, 120s safety poll) or by hand. Decides which
# profile the connected displays imply, enforces the home twin-panel
# arrangement by EDID serial, and delegates the actual swap to set-profile.sh.
# Never assumes aerospace is alive — display hotplug can crash it
# (nikitabobko/AeroSpace#506), so display identity comes from system_profiler.
#
#   apply-profile.sh [reason]        reconcile ("display-event"|"poll"|"startup"|"manual")
#   apply-profile.sh --detect-only   print the profile the displays imply, no actions
#
# State lives under ~/.config/aerospace/.profile-watcher/ (real dir in $HOME,
# never reaches the repo):
#   lock/       atomic-mkdir mutex (flock does not exist on this Mac)
#   converged   last profile confirmed applied while aerospace was responsive
#   lastset     last topology whose implications were fully applied (see
#               note_topo); a mismatch vs the live topology marks a pending
#               repair, retried on any tick — spurious display notifications
#               with an unchanged topology stay no-ops
#   unknown     last unrecognized display set, to suppress repeat logging

set -u
PATH="/opt/homebrew/bin:/usr/local/bin:/usr/sbin:/usr/bin:/bin"

# jq ships with macOS (/usr/bin/jq); without it display parsing is impossible
# and every reconcile would misreport as a transient query failure.
command -v jq >/dev/null 2>&1 || { printf 'apply-profile.sh: jq not found on PATH — cannot reconcile\n' >&2; exit 1; }

conf="$HOME/.config/aerospace"
state="$conf/.profile-watcher"
log="$HOME/Library/Logs/AeroSpace/profile-watcher.log"
sentinel="$conf/.active-profile"
bdcli="/Applications/BetterDisplay.app/Contents/MacOS/BetterDisplay"

# Home rig: both ASUS panels share one EDID UUID (binary serial zeroed at the
# factory), so macOS arrangement memory cannot tell them apart and may swap
# them across replugs. Their EDID *alphanumeric* serials are unique, and
# BetterDisplay can address panels by them. Placements captured 2026-06-11:
# ...633 is the primary. Update here if a panel is replaced or rearranged.
home_arrangement="T9LMTF156633:0x0
T9LMTF156643:-1920x0"

say() { printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S')" "$*" >>"$log"; }

# ---- display identity (aerospace-independent) -------------------------------

sp_cache=""
sp_json() {
  if [ -z "$sp_cache" ]; then
    if [ -n "${SP_JSON_FIXTURE:-}" ]; then
      sp_cache=$(cat "$SP_JSON_FIXTURE")
    else
      sp_cache=$(system_profiler SPDisplaysDataType -json 2>/dev/null)
    fi
  fi
  printf '%s' "$sp_cache"
}

# Names of ONLINE EXTERNAL displays, one per line. Empty output with rc 0
# means "built-in only"; rc 1 means the query itself failed (transient).
online_externals() {
  local json
  json=$(sp_json)
  [ -n "$json" ] || return 1
  jq -r '
    .SPDisplaysDataType[]?.spdisplays_ndrvs[]?
    | select(.spdisplays_online == "spdisplays_yes")
    | select(.spdisplays_connection_type != "spdisplays_internal")
    | ._name' <<<"$json" 2>/dev/null || return 1
}

# Full online topology fingerprint (internal included, so lid open/close at
# home/office still registers as a change even though the profile does not).
topology() {
  local json
  json=$(sp_json)
  [ -n "$json" ] || return 1
  jq -r '
    .SPDisplaysDataType[]?.spdisplays_ndrvs[]?
    | select(.spdisplays_online == "spdisplays_yes")
    | ._name' <<<"$json" 2>/dev/null | sort | paste -sd, -
}

# Mapping keys on external identity only — in clamshell the built-in vanishes
# from the display set, and it reports as "Color LCD" anyway, so its presence
# must never influence the verdict.
detect_profile() {
  local ext
  ext=$(online_externals) || { echo ""; return; }
  if grep -q "VG279QE5A" <<<"$ext"; then
    echo home
  elif grep -qE "LG ULTRAWIDE|ASUS VA24E" <<<"$ext"; then
    echo office
  elif [ -z "$ext" ]; then
    echo laptop
  else
    echo unknown
  fi
}

if [ "${1:-}" = "--detect-only" ]; then
  detect_profile
  exit 0
fi

reason=${1:-manual}
mkdir -p "$state" "$(dirname "$log")"

# ---- concurrency guard ------------------------------------------------------

acquire() {
  local tries=0 opid
  while ! mkdir "$state/lock" 2>/dev/null; do
    opid=$(cat "$state/lock/pid" 2>/dev/null || true)
    if [ -n "$opid" ] && ! kill -0 "$opid" 2>/dev/null; then
      rm -rf "$state/lock"
      continue
    fi
    # No live holder pid and untouched for >2 min: a holder died between
    # mkdir and writing its pid. Reclaim rather than wedge forever.
    if [ -z "$opid" ] && [ -n "$(find "$state/lock" -maxdepth 0 -mmin +2 2>/dev/null)" ]; then
      rm -rf "$state/lock"
      continue
    fi
    tries=$((tries + 1))
    if [ "$tries" -ge 40 ]; then
      say "tick($reason): lock busy — in-flight reconcile owns final state, exiting"
      exit 0
    fi
    sleep 0.25
  done
  echo $$ >"$state/lock/pid"
  trap 'rm -rf "$state/lock"' EXIT INT TERM
}

# ---- home twin-panel arrangement enforcement --------------------------------

arrangement_fixed=0

enforce_home_arrangement() {
  [ -x "$bdcli" ] || { say "BetterDisplay CLI missing — cannot enforce twin-panel arrangement"; return; }
  local serial want cur out back
  while IFS=: read -r serial want; do
    [ -n "$serial" ] || continue
    cur=$("$bdcli" get --alphanumericSerial="$serial" --placement 2>/dev/null) || cur=""
    case "$cur" in
      "" | Failed.)
        say "arrangement: panel $serial not addressable — skipped" ;;
      "$want") ;; # guard-before-write: correct already, generate no event churn
      *)
        out=$("$bdcli" set --alphanumericSerial="$serial" --placement="$want" 2>&1) || true
        # BetterDisplay exits 0 even when the placement does not stick
        # (Jun 27–Jul 1: 1067 false "corrected" logs drove an aerospace
        # reload every poll for days) — trust only the readback.
        back=$("$bdcli" get --alphanumericSerial="$serial" --placement 2>/dev/null) || back=""
        if [ "$back" != "$want" ]; then
          # One settle retry: a placement that lands just after set returns
          # must still count as moved, or the config re-apply never fires
          # (topology names do not change on a placement move).
          sleep 0.5
          back=$("$bdcli" get --alphanumericSerial="$serial" --placement 2>/dev/null) || back=""
        fi
        if [ "$back" = "$want" ]; then
          say "arrangement: moved panel $serial $cur -> $want"
          arrangement_fixed=1
        else
          say "arrangement: set for panel $serial did not stick (want $want, readback ${back:-none})${out:+: $out}"
        fi ;;
    esac
  done <<<"$home_arrangement"
}

aerospace_ok() { aerospace list-workspaces --all >/dev/null 2>&1; }

# Record the observed topology as handled. Called only once a tick's outcome
# is settled, so a change observed while aerospace is down (or a failed
# re-apply) stays pending in lastset and a later tick retries it.
note_topo() {
  [ -n "$topo" ] || return 0
  printf '%s' "$topo" >"$state/lastset"
}

# Re-run the full swap rather than a bare reload-config: reload-config
# repairs aerospace's force-assignment (#520), but sketchybar pins workspace
# items to displays exactly once per reload, so only set-profile.sh's
# sketchybar --reload can heal a bar that bootstrapped off a partial monitor
# set (the late-enumerating-display race, 2026-07-06/07 incidents).
resync() {
  if "$conf/set-profile.sh" "$want" >>"$log" 2>&1 && aerospace_ok; then
    note_topo
    say "tick($reason): '$want' $1 — full swap re-applied"
  else
    rm -f "$state/converged"
    say "tick($reason): '$want' $1 — re-apply incomplete, left unconverged for retry"
  fi
}

# ---- reconcile ---------------------------------------------------------------

main() {
  acquire
  local want cur conv sig topo prev_topo swap_rc
  want=$(detect_profile)
  cur=$(cat "$sentinel" 2>/dev/null || true)
  conv=$(cat "$state/converged" 2>/dev/null || true)

  topo=$(topology || true)
  prev_topo=$(cat "$state/lastset" 2>/dev/null || true)

  case "$want" in
    "")
      say "tick($reason): display query failed — transient, no-op"
      exit 0
      ;;
    unknown)
      # Record the topology even though the profile is kept: the
      # unrecognized display detaching must still read as a change so the
      # resync below fires on the detach.
      note_topo
      sig=$(online_externals | sort | paste -sd, -)
      if [ "$sig" != "$(cat "$state/unknown" 2>/dev/null || true)" ]; then
        printf '%s' "$sig" >"$state/unknown"
        say "tick($reason): unrecognized externals [$sig] — keeping '$cur', no-op"
      fi
      exit 0
      ;;
  esac
  rm -f "$state/unknown"

  [ "$want" = home ] && enforce_home_arrangement

  if [ "$want" = "$cur" ] && [ "$want" = "$conv" ]; then
    if [ "$arrangement_fixed" = 1 ]; then
      # Monitor IDs follow arrangement order; re-apply so force-assignment
      # and the bar's display map land on the corrected layout.
      resync "arrangement corrected"
    elif [ "$topo" != "$prev_topo" ] && aerospace_ok; then
      # Same profile but the display set changed (late-enumerating panel,
      # lid open/close, monitor power cycle) — whichever tick notices it,
      # display-event or poll: reconnects can leave force-assigned
      # workspaces stuck on the main display (nikitabobko/AeroSpace#520)
      # and the bar pinned to a stale display map. Spurious notifications
      # with an unchanged topology stay strict no-ops.
      resync "topology now [$topo]"
    else
      say "tick($reason): '$want' converged — no-op"
    fi
    exit 0
  fi

  if [ "$want" != "$cur" ]; then
    say "tick($reason): switching '$cur' -> '$want'"
  else
    say "tick($reason): '$want' set but never converged — re-applying"
  fi
  # set-profile.sh is the single existing swap entry point. Re-running it is
  # idempotent and also re-runs migrate-to-laptop.sh, which repairs windows
  # stranded on workspaces 6-0 if the first attempt ran while aerospace was
  # down.
  swap_rc=0
  "$conf/set-profile.sh" "$want" >>"$log" 2>&1 || swap_rc=$?

  if [ "$swap_rc" -eq 0 ] && aerospace_ok; then
    note_topo
    printf '%s' "$want" >"$state/converged"
    say "converged on '$want' (aerospace responsive)"
  else
    rm -f "$state/converged"
    say "swap to '$want' incomplete (set-profile rc=$swap_rc) — left unconverged for retry"
  fi
}

main
