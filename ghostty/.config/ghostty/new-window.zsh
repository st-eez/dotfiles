#!/usr/bin/env zsh
set -euo pipefail

if (( $# != 1 )); then
  print -u2 "usage: ${0:t} <working-directory>"
  exit 64
fi

cwd=$1
ghostty --window-inherit-working-directory=false --working-directory="$cwd" >/dev/null 2>&1 &!
