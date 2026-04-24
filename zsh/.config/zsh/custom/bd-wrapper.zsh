# bd init wrapper: reconciles bd's default integration output with our own
# workflow rules across all agent harnesses (claude + codex + anything else
# reading AGENTS.md).
#
# After `bd init`, we:
#   1. Replace .beads/PRIME.md with our template (bd prime's output).
#   2. Replace the <!-- BEGIN BEADS INTEGRATION --> block inside CLAUDE.md.
#   3. Replace the same block inside AGENTS.md.
#   4. Write .claude/settings.json so Claude Code SessionStart/PreCompact
#      auto-inject `bd prime`.
#   5. Write .codex/hooks.json so Codex SessionStart auto-injects `bd prime`.
#
# Source of truth: $HOME/.dotfiles/beads/templates/{prime,claude,agents}.md
# Scope:
#   - `bd init` runs upstream init, then applies our integration.
#   - `bd reapply-integration` applies only our integration to an existing repo.
#   - Every other bd subcommand passes through.
bd() {
  if ! command -v bd >/dev/null 2>&1; then
    echo "bd: not installed" >&2
    return 127
  fi

  if [[ "$1" == "reapply-integration" ]]; then
    shift
    _bd_wrapper_reapply_integration "$@"
  elif [[ "$1" == "init" ]]; then
    command bd "$@" || return $?
    _bd_wrapper_post_init
  else
    command bd "$@"
  fi
}

_bd_wrapper_reapply_integration() {
  if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    cat <<'EOF'
Usage: bd reapply-integration

Reapply the dotfiles-managed Beads integration to an existing bd repo:
  - .beads/PRIME.md
  - CLAUDE.md Beads block, when markers exist
  - AGENTS.md Beads block, when markers exist
  - .claude/settings.json bd prime hooks
  - .codex/hooks.json bd prime hook

This does not run bd init or modify the Beads database.
EOF
    return 0
  fi

  if [[ "$#" -ne 0 ]]; then
    echo "Usage: bd reapply-integration" >&2
    return 2
  fi

  if [[ ! -d .beads ]]; then
    echo "bd reapply-integration: no .beads directory in current repo" >&2
    return 1
  fi

  _bd_wrapper_post_init
}

_bd_wrapper_post_init() {
  local templates="$HOME/.dotfiles/beads/templates"

  [[ -d .beads ]] || return 0
  if [[ ! -d "$templates" ]]; then
    echo "bd-wrapper: templates dir missing: $templates" >&2
    return 0
  fi

  if [[ -f "$templates/prime.md" ]]; then
    cp -f "$templates/prime.md" .beads/PRIME.md
    echo "bd-wrapper: wrote .beads/PRIME.md"
  fi

  _bd_wrapper_replace_block CLAUDE.md "$templates/claude.md"
  _bd_wrapper_replace_block AGENTS.md "$templates/agents.md"
  _bd_wrapper_write_claude_hooks
  _bd_wrapper_write_codex_hooks
}

# Swap the content between <!-- BEGIN BEADS INTEGRATION --> and
# <!-- END BEADS INTEGRATION --> in $1 with the contents of $2. Preserves the
# marker lines themselves. Silent no-op if file or markers are absent.
_bd_wrapper_replace_block() {
  local file="$1" template="$2"
  [[ -f "$file" && -f "$template" ]] || return 0
  grep -q '^<!-- BEGIN BEADS INTEGRATION' "$file" || return 0
  grep -q '^<!-- END BEADS INTEGRATION'   "$file" || return 0

  local tmp
  tmp="$(mktemp)" || return 1
  awk -v tf="$template" '
    BEGIN {
      while ((getline line < tf) > 0) content = content line "\n"
      close(tf)
      sub(/\n$/, "", content)
    }
    /^<!-- BEGIN BEADS INTEGRATION/ { print; print content; in_block=1; next }
    /^<!-- END BEADS INTEGRATION/   { print; in_block=0; next }
    in_block                         { next }
    { print }
  ' "$file" > "$tmp" && mv "$tmp" "$file"
  echo "bd-wrapper: replaced BEADS block in $file"
}

# Write project-scoped Claude Code hooks so SessionStart and PreCompact
# auto-inject `bd prime`. This mirrors bd's native Claude project integration
# while keeping the wrapper idempotent for repos initialized before bd shipped it.
_bd_wrapper_write_claude_hooks() {
  mkdir -p .claude || return 1
  local settings=.claude/settings.json

  if ! command -v python3 >/dev/null 2>&1; then
    if [[ -f "$settings" ]]; then
      echo "bd-wrapper: python3 missing; leaving existing .claude/settings.json unchanged" >&2
      return 0
    fi
    cat > "$settings" <<'EOF'
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bd prime"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bd prime"
          }
        ]
      }
    ]
  }
}
EOF
    echo "bd-wrapper: wrote .claude/settings.json"
    return 0
  fi

  python3 - "$settings" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
try:
    data = json.loads(path.read_text())
except FileNotFoundError:
    data = {}
except json.JSONDecodeError as exc:
    print(f"bd-wrapper: invalid {path}: {exc}", file=sys.stderr)
    sys.exit(1)

hooks = data.setdefault("hooks", {})

def ensure_bd_prime(event):
    groups = hooks.setdefault(event, [])
    for group in groups:
        if group.get("matcher", "") != "":
            continue
        commands = group.setdefault("hooks", [])
        for hook in commands:
            if hook.get("type") == "command" and hook.get("command") == "bd prime":
                return False
        commands.append({"type": "command", "command": "bd prime"})
        return True

    groups.append({
        "matcher": "",
        "hooks": [
            {"type": "command", "command": "bd prime"},
        ],
    })
    return True

changed = ensure_bd_prime("SessionStart")
changed = ensure_bd_prime("PreCompact") or changed

if changed:
    path.write_text(json.dumps(data, indent=2) + "\n")
    print("bd-wrapper: updated .claude/settings.json")
else:
    print("bd-wrapper: .claude/settings.json already wired")
PY
}

# Write project-scoped codex hook so SessionStart auto-injects `bd prime`.
# Codex treats project-local hooks as trust-gated — you'll be prompted once
# per new repo to mark it trusted before the hook fires.
_bd_wrapper_write_codex_hooks() {
  mkdir -p .codex || return 1
  cat > .codex/hooks.json <<'EOF'
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "bd prime",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
EOF
  echo "bd-wrapper: wrote .codex/hooks.json"
}
