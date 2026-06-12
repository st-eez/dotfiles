# CLAUDE.md

SketchyBar config using the Lua API (sketchybar_lua) with AeroSpace workspace integration.

## Commands

- `sketchybar --reload` — reload after changes
- `sketchybar --query <item>` — debug item state

## Architecture

`sketchybarrc` → `init.lua` → requires colors/settings, then loads `items/*.lua` (each item requires `icons` as needed).

AeroSpace monitor profiles (`settings.monitors.profiles`) map AeroSpace monitor IDs to SketchyBar display IDs, selected by connected display name matching.
