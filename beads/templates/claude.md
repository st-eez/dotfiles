## Beads Issue Tracker

This repo uses **bd (beads)** for durable work tracking. Full rules, creation rubric, and command reference auto-load via `bd prime` on SessionStart and PreCompact (`.claude/settings.json` hooks). The dotfiles shim serves `bd prime` from the canonical dotfiles template, and `.beads/PRIME.md` is symlinked to that template when integration is reapplied. Run `bd prime` manually for a refresh.
