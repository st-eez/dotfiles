# Dotfiles

## Commands
```sh
# Re-stow a package (simulate first, add --no-folding if target dir has non-stow files)
stow --dir="$HOME/Projects/Personal/dotfiles" --target="$HOME" --simulate --verbose --restow <package>
stow --dir="$HOME/Projects/Personal/dotfiles" --target="$HOME" --restow <package>

# Remove stow symlink safely
unlink <target-path>  # never rm -r on symlinked paths

# Fix monitor ID drift
aerospace list-monitors
# Update monitor IDs in:
# - aerospace/.config/aerospace/aerospace-home.toml
# - sketchybar/.config/sketchybar/settings.lua
aerospace reload-config && sketchybar --reload
```

## Rules
- Edit repo source files, never stow targets in `$HOME`.
- Zsh uses ZDOTDIR (`~/.config/zsh/`) — edit there, not `~/.zshrc`.
- Do not edit files marked `Managed by theme-set`; edit `themes/configs/<theme>/`.
- If keyboard shortcuts change, also update `raycast/extensions/keybinds/src/search-keybinds.tsx`.
- **Do NOT use `--no-folding` for the `claude` package** — stow should fold `~/.claude/skills/` into a directory symlink so new skills created anywhere land directly in the dotfiles repo.


<!-- BEGIN BEADS INTEGRATION v:1 profile:full hash:f65d5d33 -->
## Beads Issue Tracker

This repo uses **bd (beads)** for durable work tracking. Run `bd prime` for the full rules, session close protocol, and bead-creation rubric.

### What goes where
- **Durable work** (issues, follow-ups, blockers, anything outlasting the session) → `bd create`.
- **Ephemeral in-session lists** (plans, transient todos) → TodoWrite/TaskCreate. Do **not** promote these to beads.
- **Memory** → codex native memories at `~/.codex/memories/` (global, auto-generated from idle threads — **do not hand-edit**). Durable rules go here in `AGENTS.md` or in `bd prime`, not in memories. **Do NOT use `bd remember`.**

### Hard rules
- **Never `bd edit`** — opens `$EDITOR` and blocks the agent. Use `bd update ...` / `bd note ...` / `bd comment ...`.
- Priority is `P0-P4` or `0-4`, never the word form.
- Every bead must be **atomic and self-contained**: a stranger with repo access should be able to start it tomorrow with zero other context. Title names the outcome, not the area. Include context, desired state, why, acceptance criteria, and known unknowns. Full rubric + example in `bd prime`.

### Quick reference
```bash
bd ready                               # Find available work
bd show <id>                           # View issue details
bd update <id> --claim                 # Claim work
bd create -l label1,label2 --deps id1  # Create with labels + deps
bd close <id> --reason "..."           # Close with reason
```

Before saying "done": `bd close <completed-ids> --reason "..."`.
<!-- END BEADS INTEGRATION -->
