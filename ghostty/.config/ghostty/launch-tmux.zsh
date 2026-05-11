#!/usr/bin/env zsh
set -euo pipefail

lock_dir="${XDG_RUNTIME_DIR:-/tmp}/ghostty-tmux-session.lock"
while ! mkdir "$lock_dir" 2>/dev/null; do
  sleep 0.05
done

release_lock() {
  rmdir "$lock_dir" 2>/dev/null || true
}

trap 'release_lock' EXIT
trap 'release_lock; exit 0' HUP TERM INT

sess=""
for i in {1..99}; do
  candidate="ghostty-$i"
  if ! tmux has-session -t "=$candidate" 2>/dev/null; then
    tmux new-session -d -s "$candidate"
    sess="$candidate"
    break
  fi
done

if [[ -z "$sess" ]]; then
  print -u2 "No free Ghostty tmux session slots"
  exit 1
fi

release_lock
trap - EXIT HUP TERM INT

cleanup_session() {
  tmux kill-session -t "=$sess" 2>/dev/null || true
}

cleanup_and_exit() {
  cleanup_session
  exit 0
}

trap cleanup_session EXIT
trap cleanup_and_exit HUP TERM

tmux attach-session -t "=$sess" || true
tmux has-session -t "=$sess" 2>/dev/null && zsh -i
