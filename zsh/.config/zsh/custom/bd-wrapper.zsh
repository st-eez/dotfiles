# bd init wrapper: drops a custom .beads/PRIME.md override after bd init.
#
# Why: bd prime's default output is opinionated (prohibits TodoWrite, forces
# bd remember over native memory). We ship our own workflow rules via a
# PRIME.md override — `bd prime` reads .beads/PRIME.md and emits that instead.
# --mcp flag becomes a no-op once the override exists, so the plain `bd prime`
# hook that `bd init` writes is already correct; we just drop the override.
#
# Scope: only `bd init` is intercepted. Every other bd subcommand passes through.
bd() {
  if ! command -v bd >/dev/null 2>&1; then
    echo "bd: not installed" >&2
    return 127
  fi

  if [[ "$1" == "init" ]]; then
    command bd "$@" || return $?
    local template="$HOME/.claude/templates/beads-prime.md"
    if [[ -f "$template" && -d .beads ]]; then
      cp "$template" .beads/PRIME.md
      echo "bd-wrapper: dropped .beads/PRIME.md override from $template"
    fi
  else
    command bd "$@"
  fi
}
