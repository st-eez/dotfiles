#!/usr/bin/env zsh
set -euo pipefail

lock_dir="${XDG_RUNTIME_DIR:-/tmp}/ghostty-tmux-session.lock"
while ! mkdir "$lock_dir" 2>/dev/null; do
  sleep 0.05
done

sess=""

release_lock() {
  rmdir "$lock_dir" 2>/dev/null || true
}

cleanup_session() {
  if [[ -n "${sess:-}" ]]; then
    tmux kill-session -t "=$sess" 2>/dev/null || true
  fi
}

cleanup() {
  cleanup_session
  release_lock
}

cleanup_and_exit() {
  cleanup
  exit 0
}

trap cleanup EXIT
trap cleanup_and_exit HUP TERM INT

for i in {1..99}; do
  candidate="ghostty-$i"
  if ! tmux has-session -t "=$candidate" 2>/dev/null; then
    sess="$candidate"
    tmux new-session -d -s "$sess"
    break
  fi
done

if [[ -z "$sess" ]]; then
  print -u2 "No free Ghostty tmux session slots"
  exit 1
fi

release_lock

tmux attach-session -t "=$sess" || true
tmux has-session -t "=$sess" 2>/dev/null && zsh -i
