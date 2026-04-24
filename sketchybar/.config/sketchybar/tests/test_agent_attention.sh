#!/usr/bin/env bash
# Regression test for agent_attention.sh output contract.
# Stubs agent-state and tmux, runs the helper, and asserts the TSV schema.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPER="$SCRIPT_DIR/../helpers/agent_attention.sh"

[[ -x "$HELPER" ]] || { echo "helper missing or not executable: $HELPER" >&2; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# Preserve jq/core tool paths; prepend our stub dir so it wins over the real tmux
# and agent-state.
JQ_BIN="$(command -v jq 2>/dev/null || true)"
[[ -n "$JQ_BIN" ]] || { echo "jq is required to run this test" >&2; exit 1; }

# Exercise the live SketchyBar/launchd risk: on macOS, /usr/bin/env bash can
# resolve to /bin/bash 3.2. The helper must not require Bash 4-only features.
if [[ -x /bin/bash ]]; then
  BASH_BIN="/bin/bash"
elif command -v bash >/dev/null 2>&1; then
  BASH_BIN="$(command -v bash)"
else
  echo "bash required" >&2; exit 1
fi
BASH_DIR="$(dirname "$BASH_BIN")"

cat > "$tmp/agent-state" <<'EOF'
#!/usr/bin/env bash
cat <<'JSON'
[
  {"pane":"%42","agent":"codex","state":"idle","name":"steez","detail":{"session_id":"019da911-81f8-7721-99ea-b622f3ea4391","cwd":null,"transcript_path":null}},
  {"pane":"%57","agent":"ren","state":"working","name":"ren-alpha","detail":{"session_id":"a4fc19d7-ad1e-44fe-9b8f-42cb4c0ddebf","cwd":null,"transcript_path":null}},
  {"pane":"%99","agent":"ren","state":"blocked:question","name":"ren-beta","detail":{"session_id":null,"cwd":null,"transcript_path":null}}
]
JSON
EOF
chmod +x "$tmp/agent-state"

cat > "$tmp/tmux" <<'EOF'
#!/usr/bin/env bash
# Minimal list-panes stub. Tab-delimited: pane_id, session, window_index, pane_index.
if [[ "${1:-}" == "list-panes" ]]; then
  printf '%%42\tMac\t1\t1\n'
  printf '%%57\tMac\t2\t3\n'
  # %99 intentionally absent -> helper must emit `?:?.?`
fi
EOF
chmod +x "$tmp/tmux"

# HOME override neutralises the helper's hardcoded ~/.steez/bin and ~/.local/bin
# PATH prefix (those dirs do not exist under $tmp), so our stubs win.
actual=$(HOME="$tmp" PATH="$tmp:$BASH_DIR:$(dirname "$JQ_BIN"):/usr/bin:/bin" "$BASH_BIN" "$HELPER")

expected=$'%42\tcodex\tidle\tsteez\tMac:1.1\t019da911-81f8-7721-99ea-b622f3ea4391\n%57\tren\tworking\tren-alpha\tMac:2.3\ta4fc19d7-ad1e-44fe-9b8f-42cb4c0ddebf\n%99\tren\tblocked:question\tren-beta\t?:?.?\t'

visible() { printf '%s' "$1" | sed -e 's/	/\\t/g' -e 's/$/\\n/'; }

if [[ "$actual" != "$expected" ]]; then
  echo "FAIL: agent_attention.sh output mismatch" >&2
  echo "--- expected ---" >&2
  visible "$expected" >&2; echo >&2
  echo "--- actual ---" >&2
  visible "$actual" >&2; echo >&2
  exit 1
fi

echo "ok: agent_attention.sh emits pane, agent, state, name, session:window.pane, session_id"
