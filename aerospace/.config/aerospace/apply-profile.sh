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
#   lastset     last online display-name topology, to skip churn on spurious
#               display notifications (dock visibility etc.)
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
  local serial want cur out
  while IFS=: read -r serial want; do
    [ -n "$serial" ] || continue
    cur=$("$bdcli" get --alphanumericSerial="$serial" --placement 2>/dev/null) || cur=""
    case "$cur" in
      "" | Failed.)
        say "arrangement: panel $serial not addressable — skipped" ;;
      "$want") ;; # guard-before-write: correct already, generate no event churn
      *)
        if out=$("$bdcli" set --alphanumericSerial="$serial" --placement="$want" 2>&1); then
          say "arrangement: moved panel $serial $cur -> $want"
          arrangement_fixed=1
        else
          say "arrangement: FAILED moving panel $serial -> $want: $out"
        fi ;;
    esac
  done <<<"$home_arrangement"
}

aerospace_ok() { aerospace list-workspaces --all >/dev/null 2>&1; }

# ---- reconcile ---------------------------------------------------------------

main() {
  acquire
  local want cur conv sig topo prev_topo
  want=$(detect_profile)
  cur=$(cat "$sentinel" 2>/dev/null || true)
  conv=$(cat "$state/converged" 2>/dev/null || true)

  # Track topology on every tick — including the unknown path — so an
  # unrecognized display attaching and detaching still registers as a change
  # and the #520 reload below fires on the detach.
  topo=$(topology || true)
  prev_topo=$(cat "$state/lastset" 2>/dev/null || true)
  [ -n "$topo" ] && printf '%s' "$topo" >"$state/lastset"

  case "$want" in
    "")
      say "tick($reason): display query failed — transient, no-op"
      exit 0
      ;;
    unknown)
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
      # lands on the corrected layout.
      aerospace reload-config >/dev/null 2>&1 || true
      say "tick($reason): '$want' arrangement corrected — aerospace config re-applied"
    elif [ "$reason" = display-event ] && [ "$topo" != "$prev_topo" ] && aerospace_ok; then
      # Same profile but the display set changed (lid open/close, monitor
      # power cycle): reconnects can leave force-assigned workspaces stuck on
      # the main display (nikitabobko/AeroSpace#520); a cheap reload re-applies
      # the assignment. Spurious notifications with an unchanged topology, and
      # polls/startup, stay strict no-ops.
      aerospace reload-config >/dev/null 2>&1 || true
      say "tick($reason): '$want' topology now [$topo] — force-assignment re-applied"
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
  "$conf/set-profile.sh" "$want" >>"$log" 2>&1 \
    || say "set-profile.sh failed rc=$? — poll will retry"

  if aerospace_ok; then
    printf '%s' "$want" >"$state/converged"
    say "converged on '$want' (aerospace responsive)"
  else
    rm -f "$state/converged"
    say "aerospace unresponsive after applying '$want' — left unconverged for retry"
  fi
}

main
