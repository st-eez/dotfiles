# CLAUDE.md

SketchyBar config using the Lua API (sketchybar_lua) with Rift WM workspace integration.

## Commands

- `sketchybar --reload` — reload after changes
- `sketchybar --query <item>` — debug item state

## Architecture

`sketchybarrc` → `init.lua` → loads colors/settings/icons then `items/*.lua`.

Rift uses per-macOS-Space virtual workspaces (10 per display). `spaces_rift.lua` queries `rift-cli` for displays and workspaces, creates items named `space.<space_id>.<ws_name>`, and assigns each set to its display via `screen_id`. Events are pushed from `rift-cli subscribe cli` into custom SketchyBar events (`rift_workspace_change`, `rift_windows_change`).

The original AeroSpace integration is preserved in `spaces.lua` for rollback — swap back in `init.lua` if needed.
