#!/usr/bin/env zsh
set -euo pipefail

if (( $# != 1 )); then
  print -u2 "usage: ${0:t} <working-directory>"
  exit 64
fi

cwd=$1
osascript - "$cwd" <<'APPLESCRIPT'
on run argv
  set cwd to item 1 of argv
  tell application id "com.mitchellh.ghostty"
    set cfg to new surface configuration from {initial working directory:cwd}
    new window with configuration cfg
  end tell
end run
APPLESCRIPT
