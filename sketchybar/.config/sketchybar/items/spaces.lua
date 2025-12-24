local colors = require("colors")
local settings = require("settings")
local icons = require("icons")
local sbar = require("sketchybar")

-- Add helpers to package path to load icon_map
package.path = package.path .. ";./helpers/?.lua"
local app_icons = require("helpers.icon_map")

local monitor_profiles = (settings.monitors and settings.monitors.profiles) or {}
local default_monitor_profile = (settings.monitors and settings.monitors.default_profile) or "home"
local laptop_display = (settings.monitors and settings.monitors.laptop_display) or 1

local spaces = {}
local current_workspace = nil
local window_cache = {} -- Cache icon strings to skip redundant item:set() calls

-- Styling Constants
local active_color = colors.white
-- Tokyo Night comment-ish tone for inactive state
local inactive_color = 0xff565f89
local highlight_tint = colors.highlight or 0x337aa2f7 -- 20% Blue tint
local transparent = colors.transparent

-- Function to update window icons for a specific space
-- Uses cache to skip item:set() when icons haven't changed
local function update_windows(space_id)
  sbar.exec("aerospace list-windows --workspace " .. space_id .. " --format '%{app-name}'", function(apps)
    local icon_line = ""
    if apps then
      for app in apps:gmatch("[^\r\n]+") do
        local icon = app_icons[app] or app_icons["Default"] or icons.activity
        icon_line = icon_line .. " " .. icon
      end
    end
    -- Only update if changed (avoids redundant WindowServer constraint operations)
    if spaces[space_id] and window_cache[space_id] ~= icon_line then
      window_cache[space_id] = icon_line
      spaces[space_id]:set({ label = icon_line })
    end
  end)
end

-- Function to update highlighting (Focus/Unfocus)
-- Optimized: only updates the 2 items that changed (prev unfocused, new focused)
-- Exception: on first call (init), styles all items to set proper padding
local function update_highlight(focused_sid)
  local prev_workspace = current_workspace
  current_workspace = focused_sid

  -- Helper to apply style to a single item
  local function apply_style(sid, is_selected)
    if not spaces[sid] then return end
    local icon_font = is_selected
      and { style = settings.font.style_map.bold, size = 16.0 }
      or { style = settings.font.style_map.regular, size = 16.0 }

    spaces[sid]:set({
      icon = {
        highlight = is_selected,
        font = icon_font,
        padding_left = 12,
        padding_right = 2,
      },
      label = {
        highlight = is_selected,
        color = is_selected and active_color or inactive_color,
        padding_left = 4,
        padding_right = 18,
      },
      background = {
        border_color = transparent,
        color = is_selected and highlight_tint or transparent
      }
    })
  end

  -- First call (init): style ALL items to establish proper padding
  if not prev_workspace then
    for sid, _ in pairs(spaces) do
      apply_style(sid, tostring(sid) == tostring(focused_sid))
    end
    return
  end

  -- Subsequent calls: only update the 2 items that changed
  if prev_workspace ~= focused_sid then
    apply_style(prev_workspace, false)
  end
  apply_style(focused_sid, true)
end

-- Main Setup
-- 1. Get Monitor List to determine setup type
sbar.exec("aerospace list-monitors", function(monitor_output)
  local is_laptop_only = false
  local monitor_list = {}
  for line in monitor_output:gmatch("[^\r\n]+") do
    table.insert(monitor_list, line)
  end

  local active_profile = monitor_profiles[default_monitor_profile]
  for _, profile in pairs(monitor_profiles) do
    if profile.match and monitor_output:find(profile.match) then
      active_profile = profile
      break
    end
  end
  
  if #monitor_list == 1 and monitor_output:find("Built%-in") then
    is_laptop_only = true
  end

  -- 2. Map Workspaces to Monitors (Async chain)
  -- We need to know which monitor each workspace is on to assign display_id correctly.
  -- Since we can't do synchronous calls, we'll fetch all assignments first.
  
  local workspace_monitors = {} -- [sid] = monitor_id (1, 2, 3)
  
  local function setup_spaces()
    local workspaces = { "1", "2", "3", "4", "5", "6", "7", "8", "9", "0" }

    for _, sid in ipairs(workspaces) do
      local monitor_id = workspace_monitors[sid] or 1
      local display_id = laptop_display

      if not is_laptop_only then
        local map = (active_profile and active_profile.map) or {}
        display_id = map[monitor_id] or laptop_display
      end

      -- Create the Space Item
      spaces[sid] = sbar.add("item", "space." .. sid, {
        icon = {
          string = sid,
          color = inactive_color,
          highlight_color = active_color,
          padding_left = 6,
          padding_right = 0,
          font = { family = settings.font.family, style = settings.font.style_map.regular, size = 14.0 },
        },
        label = {
          string = "",
          color = inactive_color,
          highlight_color = colors.white,
          font = { family = "sketchybar-app-font", style = "Regular", size = 14.0 },
          y_offset = -1,
          padding_right = 10,
        },
        background = {
          color = transparent,
          border_color = transparent,
        },
        display = display_id,
        click_script = "aerospace workspace " .. sid,
        position = "left",
      })

      -- Subscribe to mouse events (Hover)
      spaces[sid]:subscribe("mouse.entered", function(env)
        spaces[sid]:set({ background = { color = highlight_tint } })
      end)

      spaces[sid]:subscribe("mouse.exited", function(env)
        if tostring(sid) ~= tostring(current_workspace) then
          spaces[sid]:set({ background = { color = transparent } })
        else
          spaces[sid]:set({ background = { color = highlight_tint } })
        end
      end)
    end

    -- Separator
    sbar.add("item", "space_separator", {
      icon = {
        string = "􀆊",
        font = { size = 14.0, style = "Black" },
        color = colors.white,
        padding_left = 10,
        padding_right = 8,
      },
      label = { drawing = false },
      position = "left",
      padding_left = 0,
      padding_right = 0,
    })

    -- Front App (placed immediately after separator for deterministic ordering)
  local front_app = sbar.add("item", "front_app", {
    icon = { drawing = false },
    label = {
      font = {
        family = settings.font.family,
          style = settings.font.style_map.bold,
          size = 13.0,
        },
      },
      display = "active",
      position = "left",
      updates = true,
    })

    front_app:subscribe("front_app_switched", function(env)
      front_app:set({ label = env.INFO })
      local target_space = current_workspace
      if target_space and spaces[target_space] then
        update_windows(target_space)
      else
        sbar.exec("aerospace list-workspaces --focused", function(f)
          local sid = f and f:match("%S+")
          if sid and spaces[sid] then
            update_windows(sid)
          end
        end)
      end
    end)

    front_app:subscribe("mouse.clicked", function(env)
      sbar.exec("open -a 'Mission Control'")
    end)

    -- Initial label population
    sbar.exec("aerospace list-windows --focused --format '%{app-name}'", function(app_name)
      if app_name and app_name ~= "" then
        front_app:set({ label = app_name:gsub("\n", "") })
      end
    end)
    -- Controller / Observer
    local spacer_observer = sbar.add("item", "spaces_observer", { drawing = false, updates = true })
    
    -- One-time initial window population for all spaces
    for s, _ in pairs(spaces) do
      update_windows(s)
    end

    spacer_observer:subscribe("aerospace_workspace_change", function(env)
      local focused_workspace = env.FOCUSED_WORKSPACE
      local prev_workspace = current_workspace -- capture before highlight updates it

      if not focused_workspace or focused_workspace == "" then
        sbar.exec("aerospace list-workspaces --focused", function(f)
          local clean_f = f:gsub("%s+", "")
          update_highlight(clean_f)

          if prev_workspace and spaces[prev_workspace] then
            update_windows(prev_workspace)
          end
          if spaces[clean_f] then
            update_windows(clean_f)
          end
        end)
      else
        update_highlight(focused_workspace)

        if prev_workspace and prev_workspace ~= focused_workspace and spaces[prev_workspace] then
          update_windows(prev_workspace)
        end
        if spaces[focused_workspace] then
          update_windows(focused_workspace)
        end
      end
    end)

    -- Refresh the focused workspace when windows are created/destroyed
    spacer_observer:subscribe("space_windows_change", function(env)
      sbar.exec("aerospace list-workspaces --focused", function(f)
        local sid = f and f:match("%S+")
        if sid and spaces[sid] then
          update_windows(sid)
        end
      end)
    end)

    -- Initial Trigger
    if next(spaces) then
      sbar.trigger("aerospace_workspace_change")
    end
  end

  -- Chain calls to populate workspace_monitors
  local function fetch_monitor_workspaces(mon_idx)
    if mon_idx > 3 then
      setup_spaces() -- Done fetching, proceed to setup
      return
    end
    
    sbar.exec("aerospace list-workspaces --monitor " .. mon_idx, function(ws_list)
      if ws_list then
        for ws in ws_list:gmatch("%S+") do
           workspace_monitors[ws] = mon_idx
        end
      end
      fetch_monitor_workspaces(mon_idx + 1)
    end)
  end

  fetch_monitor_workspaces(1) -- Start fetching for monitor 1
end)

return spaces
