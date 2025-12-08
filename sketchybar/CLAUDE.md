# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a SketchyBar configuration using the Lua API (sketchybar_lua). It creates a macOS menu bar replacement with AeroSpace workspace integration.

## Commands

```bash
# Reload config after changes
sketchybar --reload

# Force refresh a single item
sketchybar --update <item>

# Restart the launch agent (for font installs or crashes)
brew services restart sketchybar

# Query item state for debugging
sketchybar --query <item>

# View SketchyBar logs
log stream --predicate 'process == "SketchyBar"' --style compact

# Toggle bar visibility
lua toggle_topmost.lua
```

## Architecture

**Entry Point**: `sketchybarrc` → loads `init.lua` via Lua runtime

**Module Loading** (`init.lua`):
1. `colors.lua` - Tokyo Night theme hex colors (0xAARRGGBB format)
2. `settings.lua` - Font, bar dimensions, monitor profiles
3. `icons.lua` - SF Symbol glyphs for UI elements
4. `items/*.lua` - Individual bar components

**Shared Dependencies**:
- `helpers/icon_map.lua` - App name → sketchybar-app-font glyph mapping (used by `spaces.lua`)

## Key Patterns

**Item Creation**: Each `items/*.lua` file creates items via `sbar.add()` and subscribes to events:
```lua
local item = sbar.add("item", "name", { ...config })
item:subscribe("event_name", function(env) ... end)
```

**Control Center Aliases**: Some items (volume, wifi, battery) mirror macOS Control Center via `sbar.add("alias", "Control Center,ItemName", ...)` rather than custom implementations.

**AeroSpace Integration** (`items/spaces.lua`):
- Workspaces are assigned to displays via `settings.monitors.profiles`
- Monitor profiles map AeroSpace monitor IDs to SketchyBar display IDs
- Profile selection based on connected display name matching (e.g., "LG ULTRAWIDE")

## Dependencies

- **SketchyBar**: `brew install --cask sketchybar`
- **sketchybar_lua**: Lua bindings at `~/.local/share/sketchybar_lua/`
- **AeroSpace**: `brew install --cask nikitabobko/tap/aerospace` (workspace events)
- **SwitchAudioSource**: `brew install switchaudio-osx` (audio picker)
- **Font**: JetBrainsMono Nerd Font + sketchybar-app-font

## Keybind Sync Rule

Any keyboard shortcut changes must also update:
`~/Projects/Personal/dotfiles/raycast/extensions/keybinds/src/search-keybinds.tsx`
