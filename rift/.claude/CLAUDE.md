# Rift Window Manager

Tiling WM for macOS (Rust). Config: `~/.config/rift/config.toml` (TOML, hot-reloadable).

Repo & docs: https://github.com/acsandmann/rift (wiki has full config reference)

## Layout Modes

`settings.layout.mode`: `"traditional"` (i3), `"bsp"`, `"master_stack"` (dwm), `"scrolling"` (niri)

## Indexing

- Workspaces use **0-based indexing**: `switch_to_workspace = 0` is workspace "1"
- Display selectors are also 0-based

## Key Config Sections

- `[settings]` — animations, focus behavior, `run_on_start`, `hot_reload`
- `[settings.layout]` — mode, gaps (outer/inner), per-display gap overrides
- `[virtual_workspaces]` — count, names, `app_rules` for auto-assign/floating
- `[modifier_combinations]` — reusable modifier aliases (e.g. `comb1 = "Alt + Shift"`)
- `[keys]` — keybindings: `"Modifier + Key" = { command = arg }`
- `app_rules` — match via `app_name`, `app_id`, `title_regex`, `title_substring`

## CLI Commands

```
rift                        # Start (add --no-animate, --one, --default-disable)
rift --validate             # Check config without starting
rift --config <PATH>        # Use alternate config file
rift service install        # Install launchd service
rift service uninstall      # Remove launchd service
rift service start|stop|restart
```

## Gaps

Top gap is 42px for SketchyBar on external monitors. Use `per_display` overrides for built-in display (12px top). Find display UUID: `system_profiler SPDisplaysDataType`.

## Keybinding Modifiers

`Alt`/`Option`, `Ctrl`/`Control`, `Shift`, `Meta`/`Cmd`/`Command` (side-specific variants available)
