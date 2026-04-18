local colors = require("colors")
local settings = require("settings")
local icons = require("icons")
local sbar = require("sketchybar")
local app_icons = require("helpers.icon_map")

local monitor_profiles = (settings.monitors and settings.monitors.profiles) or {}
local default_monitor_profile = (settings.monitors and settings.monitors.default_profile) or "home"
local laptop_display = (settings.monitors and settings.monitors.laptop_display) or 1

-- Read the active aerospace profile from the sentinel written by set-profile.sh.
-- Missing/unreadable sentinel → nil (treated as non-laptop by callers).
local function active_profile()
  local home = os.getenv("HOME")
  if not home then return nil end
  local f = io.open(home .. "/.config/aerospace/.active-profile", "r")
  if not f then return nil end
  local s = f:read("*a") or ""
  f:close()
  return (s:gsub("%s+", ""))
end

local function is_laptop_profile_active()
  return active_profile() == "laptop"
end

local spaces = {}
local current_workspace = nil
local window_cache = {} -- Cache icon strings to skip redundant item:set() calls

-- Styling Constants
local active_color = colors.white
local inactive_color = colors.grey
local highlight_tint = colors.highlight
local transparent = colors.transparent

-- Update window icons for every known space with a single aerospace call.
-- Batching beats per-space forks (was up to N shells per event).
local function update_all_windows()
  sbar.exec("aerospace list-windows --all --format '%{workspace} %{app-name}'", function(out)
    local icons_by_space = {}
    for sid, _ in pairs(spaces) do icons_by_space[sid] = "" end

    if out then
      for line in out:gmatch("[^\r\n]+") do
        local sid, app = line:match("^(%S+)%s+(.*)$")
        if sid and app and icons_by_space[sid] ~= nil then
          local icon = app_icons[app] or app_icons["Default"] or icons.activity
          icons_by_space[sid] = icons_by_space[sid] .. " " .. icon
        end
      end
    end

    for sid, icon_line in pairs(icons_by_space) do
      if window_cache[sid] ~= icon_line then
        window_cache[sid] = icon_line
        spaces[sid]:set({ label = icon_line })
      end
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
    local icon_font = {
      style = is_selected and settings.font.style_map.bold or settings.font.style_map.regular,
      size = settings.font.size.glyph,
    }

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
  if not monitor_output or monitor_output == "" then return end
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

  -- Render 5 workspaces whenever the laptop profile is active OR only the
  -- built-in display is connected; full 1-0 set otherwise.
  local show_five = is_laptop_profile_active() or is_laptop_only

  -- 2. Map Workspaces to Monitors (Async chain)
  -- We need to know which monitor each workspace is on to assign display_id correctly.
  -- Since we can't do synchronous calls, we'll fetch all assignments first.
  
  local workspace_monitors = {} -- [sid] = monitor_id (1, 2, 3)
  
  local function setup_spaces()
    local workspaces = show_five
      and { "1", "2", "3", "4", "5" }
      or { "1", "2", "3", "4", "5", "6", "7", "8", "9", "0" }

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
          font = { family = settings.font.family, style = settings.font.style_map.regular, size = settings.font.size.icon },
        },
        label = {
          string = "",
          color = inactive_color,
          highlight_color = colors.white,
          font = { family = "sketchybar-app-font", style = "Regular", size = settings.font.size.icon },
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
        string = icons.separator,
        font = { size = settings.font.size.icon, style = "Black" },
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
          size = settings.font.size.label,
        },
      },
      display = "active",
      position = "left",
      updates = true,
    })

    front_app:subscribe("front_app_switched", function(env)
      front_app:set({ label = env.INFO })
      update_all_windows()
    end)

    front_app:subscribe("mouse.clicked", function(env)
      sbar.exec("open -a '/System/Applications/Mission Control.app'")
    end)

    -- Initial label population
    sbar.exec("aerospace list-windows --focused --format '%{app-name}'", function(app_name)
      if app_name and app_name ~= "" then
        front_app:set({ label = app_name:gsub("\n", "") })
      end
    end)
    -- Controller / Observer
    local spacer_observer = sbar.add("item", "spaces_observer", { drawing = false, updates = true })
    
    -- Initial window population (one fork, all spaces).
    update_all_windows()

    spacer_observer:subscribe("aerospace_workspace_change", function(env)
      local focused_workspace = env.FOCUSED_WORKSPACE

      if not focused_workspace or focused_workspace == "" then
        sbar.exec("aerospace list-workspaces --focused", function(f)
          local clean_f = f and f:gsub("%s+", "") or ""
          if clean_f == "" then return end
          update_highlight(clean_f)
          update_all_windows()
        end)
      else
        update_highlight(focused_workspace)
        update_all_windows()
      end
    end)

    -- Refresh when windows are created/destroyed.
    spacer_observer:subscribe("space_windows_change", function(env)
      update_all_windows()
    end)

    -- After wake, cached strings may be stale if apps were quit while asleep.
    -- Invalidate and re-fetch in one call.
    spacer_observer:subscribe("system_woke", function(env)
      for sid, _ in pairs(spaces) do window_cache[sid] = nil end
      update_all_windows()
    end)

    -- Initial Trigger
    if next(spaces) then
      sbar.trigger("aerospace_workspace_change")
    end
  end

  -- Chain calls to populate workspace_monitors (iterate actual monitors, not hard-coded 3)
  local function fetch_monitor_workspaces(mon_idx)
    if mon_idx > #monitor_list then
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
