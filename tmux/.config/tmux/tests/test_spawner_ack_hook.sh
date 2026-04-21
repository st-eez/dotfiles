#!/usr/bin/env bash
# Regression test for tmux.conf spawner-scoped attention wiring.
#
# Contract:
#   1. Sticky attention is acknowledged when entering a window via
#      `select-window` (after-select-window hook).
#   2. Sticky attention is also acknowledged when entering a session via
#      `switch-client -t <session>` (client-session-changed hook).
#   3. The active-window format must render `@agent_monitor_attention`, or
#      current-window attention is invisible even when tmux sets the option.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMUX_CONF="$SCRIPT_DIR/../tmux.conf"
HOOK_HELPER="$SCRIPT_DIR/../hooks/ack-spawner-attention.sh"

[[ -f "$TMUX_CONF" ]] || { echo "tmux.conf missing: $TMUX_CONF" >&2; exit 1; }
[[ -x "$HOOK_HELPER" ]] || { echo "hook helper missing/not executable: $HOOK_HELPER" >&2; exit 1; }
command -v tmux >/dev/null 2>&1 || { echo "tmux required" >&2; exit 1; }

tmp=$(mktemp -d)
sock="$tmp/sock"
log="$tmp/ack.log"
client_pid=""
trap '[[ -n "$client_pid" ]] && kill "$client_pid" 2>/dev/null || true; [[ -n "$client_pid" ]] && wait "$client_pid" 2>/dev/null || true; tmux -S "$sock" kill-server 2>/dev/null || true; rm -rf "$tmp" >/dev/null 2>&1 || true' EXIT

# Stub agent-eventsd: append the --spawner arg to a log so we can
# assert which panes got acked.
mkdir -p "$tmp/bin"
cat > "$tmp/bin/agent-eventsd" <<EOF
#!/usr/bin/env bash
# Only record 'ack --spawner <pane>' invocations.
if [[ "\${1:-}" == "ack" ]]; then
  shift
  while [[ \$# -gt 0 ]]; do
    case "\$1" in
      --spawner) printf '%s\n' "\$2" >> "$log"; shift 2 ;;
      *) shift ;;
    esac
  done
fi
EOF
chmod +x "$tmp/bin/agent-eventsd"
: > "$log"

# Extract only the spawner-ack hooks from tmux.conf so the test does not
# depend on plugins, theme files, or the full config. We require both
# hooks to delegate to the helper script — keeps the wiring contract
# visible in the regression.
select_hook_line=$(grep -n "set-hook -g after-select-window" "$TMUX_CONF" \
  | grep "ack-spawner-attention.sh" | cut -d: -f1 | head -1 || true)
if [[ -z "$select_hook_line" ]]; then
  echo "FAIL: tmux.conf has no 'set-hook -g after-select-window' delegating to ack-spawner-attention.sh" >&2
  echo "      (sticky spawner attention must be acknowledged on window entry)" >&2
  exit 1
fi

session_hook_line=$(grep -n "set-hook -g client-session-changed" "$TMUX_CONF" \
  | grep "ack-spawner-attention.sh" | cut -d: -f1 | head -1 || true)
if [[ -z "$session_hook_line" ]]; then
  echo "FAIL: tmux.conf has no 'set-hook -g client-session-changed' delegating to ack-spawner-attention.sh" >&2
  echo "      (session switches must acknowledge sticky spawner attention too)" >&2
  exit 1
fi

if ! grep -F "window-status-current-format" "$TMUX_CONF" | grep -Fq "@agent_monitor_attention"; then
  echo "FAIL: window-status-current-format does not render @agent_monitor_attention" >&2
  echo "      (current-window attention would be set but invisible)" >&2
  exit 1
fi

# Assemble a minimal conf: base-index matches project, and we rewrite
# both hooks to point at the in-repo helper so the test exercises the
# real script even without stowing the package into $HOME.
cat > "$tmp/test.conf" <<EOF
set -g base-index 1
setw -g pane-base-index 1
set -g focus-events on
set-hook -g after-select-window 'run-shell -b "$HOOK_HELPER \"#{window_id}\""'
set-hook -g client-session-changed 'run-shell -b "$HOOK_HELPER \"#{window_id}\""'
EOF

# HOME override: the hook prefixes $HOME/.steez/bin on PATH so production
# agent-eventsd wins. In the test we point HOME at an empty tmp dir so
# that prefix is a no-op and our stub on the tail PATH wins instead.
export HOME="$tmp"
export PATH="$tmp/bin:$PATH"

wait_for_log_lines() {
  local min_lines="$1"
  for _ in $(seq 1 50); do
    [[ "$(wc -l < "$log" 2>/dev/null | tr -d ' ')" -ge "$min_lines" ]] && return 0
    sleep 0.1
  done
  return 1
}

drain_async_log() {
  local prev=""
  for _ in $(seq 1 20); do
    sleep 0.1
    cur=$(wc -c < "$log" 2>/dev/null | tr -d ' ')
    [[ "$cur" == "$prev" ]] && break
    prev="$cur"
  done
  : > "$log"
}

assert_only_logged() {
  local label="$1"
  shift
  local expected=("$@")
  local fail=0
  for p in "${expected[@]}"; do
    if ! grep -Fxq "$p" "$log"; then
      echo "FAIL: $label did not ack expected pane $p" >&2
      fail=1
    fi
  done

  while IFS= read -r pane; do
    [[ -n "$pane" ]] || continue
    local seen=0
    for p in "${expected[@]}"; do
      if [[ "$pane" == "$p" ]]; then
        seen=1
        break
      fi
    done
    if [[ "$seen" -eq 0 ]]; then
      echo "FAIL: $label wrongly acked pane $pane" >&2
      fail=1
    fi
  done < "$log"

  if [[ "$fail" -ne 0 ]]; then
    echo "--- ack.log ($label) ---" >&2
    sed 's/^/  /' "$log" >&2
    exit 1
  fi
}

# Real attached client: client-session-changed only fires when a live client
# changes sessions, so the test must attach one (detached servers are not
# enough).
tmux -S "$sock" -f "$tmp/test.conf" new-session -d -s A -x 200 -y 50
tmux -S "$sock" new-session -d -s B -x 200 -y 50
tmux -S "$sock" split-window -h -t B:1
tmux -S "$sock" new-window -t B:
tmux -S "$sock" select-window -t B:1
script -q /dev/null sh -lc "TMUX= tmux -S '$sock' attach-session -t A" >/dev/null 2>&1 &
client_pid=$!
sleep 0.5

# Record expected pane ids.
mapfile -t b1_panes < <(tmux -S "$sock" list-panes -t B:1 -F '#{pane_id}')
mapfile -t b2_panes < <(tmux -S "$sock" list-panes -t B:2 -F '#{pane_id}')

[[ "${#b1_panes[@]}" -eq 2 ]] || { echo "FAIL: setup expected 2 panes in B:1, got ${#b1_panes[@]}" >&2; exit 1; }
[[ "${#b2_panes[@]}" -eq 1 ]] || { echo "FAIL: setup expected 1 pane in B:2, got ${#b2_panes[@]}" >&2; exit 1; }

# Drain any hook invocations queued by setup before the acts-under-test.
drain_async_log

# Fire 1: switch sessions. client-session-changed must ack the entered
# session's current window (B:1).
tmux -S "$sock" switch-client -t B
wait_for_log_lines 2 || { echo "FAIL: switch-client produced no ack log" >&2; exit 1; }
assert_only_logged "client-session-changed" "${b1_panes[@]}"

# Fire 2: switch windows inside the session. after-select-window must ack the
# entered window (B:2) and only that window.
: > "$log"
tmux -S "$sock" select-window -t B:2
wait_for_log_lines 1 || { echo "FAIL: select-window produced no ack log" >&2; exit 1; }
assert_only_logged "after-select-window" "${b2_panes[@]}"

echo "ok: session switches and window switches both ack the entered window, and current-window attention is rendered"
