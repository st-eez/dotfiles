#!/usr/bin/env bash
# Fixture tests for apply-profile.sh's display-set -> profile mapping.
# The offline-ghost fixture guards the Online:Yes gate: an EDID name cached
# by a mid-handshake or disconnected panel must not count as present.

set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
script="$here/../aerospace/.config/aerospace/apply-profile.sh"
fail=0

check() {
  local fixture=$1 expect=$2 got
  got=$(SP_JSON_FIXTURE="$here/fixtures/$fixture" "$script" --detect-only)
  if [ "$got" = "$expect" ]; then
    echo "ok   $fixture -> $got"
  else
    echo "FAIL $fixture -> '$got' (expected '$expect')"
    fail=1
  fi
}

check office.json office
check home.json home
check clamshell-home.json home
check laptop.json laptop
check unknown.json unknown
check offline-ghost.json laptop

exit $fail
