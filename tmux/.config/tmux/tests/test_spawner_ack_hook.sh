#!/usr/bin/env bash
# Regression test for tmux.conf spawner-scoped attention ack hook.
#
# Contract: focusing a window MUST invoke `agent-eventsd ack --spawner <p>`
# for every pane `p` in that window, and MUST NOT invoke ack for panes in
# other windows. The hook is the tmux side of steez-ht6x's sticky
# spawner-scoped attention retirement.
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
trap 'tmux -S "$sock" kill-server 2>/dev/null || true; rm -rf "$tmp"' EXIT

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

# Extract only the spawner-ack hook from tmux.conf so the test does not
# depend on plugins, theme files, or the full config. We require the
# hook to delegate to the helper script — keeps the wiring contract
# visible in the regression.
hook_line=$(grep -n "set-hook -g after-select-window" "$TMUX_CONF" \
  | grep "ack-spawner-attention.sh" | cut -d: -f1 | head -1 || true)
if [[ -z "$hook_line" ]]; then
  echo "FAIL: tmux.conf has no 'set-hook -g after-select-window' delegating to ack-spawner-attention.sh" >&2
  echo "      (sticky spawner attention must be acknowledged on window entry)" >&2
  exit 1
fi

# Assemble a minimal conf: base-index matches project, and we rewrite
# the hook to point at the in-repo helper so the test exercises the
# real script even without stowing the package into $HOME.
cat > "$tmp/test.conf" <<EOF
set -g base-index 1
setw -g pane-base-index 1
set -g focus-events on
set-hook -g after-select-window 'run-shell -b "$HOOK_HELPER \"#{window_id}\""'
EOF

# HOME override: the hook prefixes $HOME/.steez/bin on PATH so production
# agent-eventsd wins. In the test we point HOME at an empty tmp dir so
# that prefix is a no-op and our stub on the tail PATH wins instead.
export HOME="$tmp"
export PATH="$tmp/bin:$PATH"

# Headless tmux: two windows, window 1 has 2 panes, window 2 has 1 pane.
tmux -S "$sock" -f "$tmp/test.conf" new-session -d -s t -x 200 -y 50
tmux -S "$sock" split-window -h -t t:1
tmux -S "$sock" new-window -t t:
# Land on window 2 so focusing window 1 is a real cross-window switch.
tmux -S "$sock" select-window -t t:2

# Record expected pane ids.
mapfile -t w1_panes < <(tmux -S "$sock" list-panes -t t:1 -F '#{pane_id}')
mapfile -t w2_panes < <(tmux -S "$sock" list-panes -t t:2 -F '#{pane_id}')

[[ "${#w1_panes[@]}" -eq 2 ]] || { echo "FAIL: setup expected 2 panes in window 1, got ${#w1_panes[@]}" >&2; exit 1; }
[[ "${#w2_panes[@]}" -eq 1 ]] || { echo "FAIL: setup expected 1 pane in window 2, got ${#w2_panes[@]}" >&2; exit 1; }

# Drain any hook invocations queued by setup. run-shell -b is async, so
# setup's select-window fires hook writes after a short delay. We poll
# for quiescence, then clear the log, so only the act-under-test shows.
prev=""
for _ in $(seq 1 20); do
  sleep 0.1
  cur=$(wc -c < "$log" 2>/dev/null | tr -d ' ')
  [[ "$cur" == "$prev" && "$cur" != "0" ]] && break
  prev="$cur"
done
: > "$log"

# Fire: switch to window 1. Hook should ack every pane in window 1.
tmux -S "$sock" select-window -t t:1

# run-shell -b backgrounds; wait for the log to settle. Poll briefly
# instead of a fixed sleep.
for _ in $(seq 1 50); do
  [[ "$(wc -l < "$log" 2>/dev/null | tr -d ' ')" -ge 2 ]] && break
  sleep 0.1
done

# Assertions.
fail=0
for p in "${w1_panes[@]}"; do
  if ! grep -Fxq "$p" "$log"; then
    echo "FAIL: hook did not ack window-1 pane $p" >&2
    fail=1
  fi
done
for p in "${w2_panes[@]}"; do
  if grep -Fxq "$p" "$log"; then
    echo "FAIL: hook wrongly acked window-2 pane $p (disturbed another spawner)" >&2
    fail=1
  fi
done

if [[ "$fail" -ne 0 ]]; then
  echo "--- ack.log ---" >&2
  sed 's/^/  /' "$log" >&2
  exit 1
fi

echo "ok: after-select-window acks every pane in the entered window and no panes elsewhere"
