# bd init wrapper: rewrites `bd prime` hooks to `bd prime --mcp` after bd init.
#
# Why: ren.md governs the beads workflow, so we want bd prime's minimal (~50 token)
# output instead of the full ~1-2k command reference. beads has no native knob for
# this — `bd init` always writes plain `bd prime` into .claude/settings.json. This
# wrapper post-processes that file after every bd init so new repos match the
# ren-flavored strategy without hand-editing.
#
# Scope: only `bd init` is intercepted. Every other bd subcommand passes through.
bd() {
  if ! command -v bd >/dev/null 2>&1; then
    echo "bd: not installed" >&2
    return 127
  fi

  if [[ "$1" == "init" ]]; then
    command bd "$@" || return $?
    [[ -f .claude/settings.json ]] || return 0
    python3 - "$PWD/.claude/settings.json" <<'PY'
import json, sys
path = sys.argv[1]
with open(path) as f:
    data = json.load(f)
changed = False
for event in ("SessionStart", "PreCompact"):
    for entry in data.get("hooks", {}).get(event, []):
        for hook in entry.get("hooks", []):
            if hook.get("command") == "bd prime":
                hook["command"] = "bd prime --mcp"
                changed = True
if changed:
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print("bd-wrapper: rewrote `bd prime` -> `bd prime --mcp` in .claude/settings.json")
PY
  else
    command bd "$@"
  fi
}
