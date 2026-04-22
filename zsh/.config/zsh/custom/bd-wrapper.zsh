# bd init wrapper: reconciles bd's default integration output with our own
# workflow rules across all agent harnesses (claude + codex + anything else
# reading AGENTS.md).
#
# After `bd init`, we:
#   1. Replace .beads/PRIME.md with our template (bd prime's output).
#   2. Replace the <!-- BEGIN BEADS INTEGRATION --> block inside CLAUDE.md.
#   3. Replace the same block inside AGENTS.md.
#   4. Write .codex/hooks.json so codex SessionStart auto-injects `bd prime`
#      (bd ships claude + gemini hooks but not codex — this closes the gap).
#
# Source of truth: $HOME/.dotfiles/beads/templates/{prime,claude,agents}.md
# Scope: only `bd init` is intercepted. Every other bd subcommand passes through.
bd() {
  if ! command -v bd >/dev/null 2>&1; then
    echo "bd: not installed" >&2
    return 127
  fi

  if [[ "$1" == "init" ]]; then
    command bd "$@" || return $?
    _bd_wrapper_post_init
  else
    command bd "$@"
  fi
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
        "matcher": "startup|resume|clear",
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
