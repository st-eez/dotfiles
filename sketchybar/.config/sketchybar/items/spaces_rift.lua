local colors = require("colors")
local settings = require("settings")
local icons = require("icons")
local sbar = require("sketchybar")

package.path = package.path .. ";./helpers/?.lua"
local app_icons = require("helpers.icon_map")

-- State: keyed by macOS space_id, each holding 10 workspace items
local spaces = {}           -- [space_id][ws_name] = sbar item
local current_workspace = {} -- [space_id] = active ws_name
local window_cache = {}     -- [space_id .. "." .. ws_name] = icon string

-- Styling Constants (same as original)
local active_color = colors.white
local inactive_color = colors.grey
local highlight_tint = colors.highlight or 0x337aa2f7
local transparent = colors.transparent

local JQ = "/usr/bin/jq"

-- Parse tab-separated workspace line emitted by jq
-- Format: "name\tis_active\tbundle_ids_csv"
local function parse_workspace_line(line)
  local name, is_active, bundles = line:match("^([^\t]+)\t([^\t]+)\t(.*)$")
  if not name then return nil end
  return {
    name = name,
    is_active = (is_active == "true"),
    bundles = bundles or "",
  }
end

-- Build icon string from comma-separated bundle_ids (app names)
local function icons_for_bundles(bundle_csv)
  local icon_line = ""
  if bundle_csv and bundle_csv ~= "" then
    for app in bundle_csv:gmatch("[^,]+") do
      local icon = app_icons[app] or app_icons["Default"] or icons.activity
      icon_line = icon_line .. " " .. icon
    end
  end
  return icon_line
end

-- Update window icons for a workspace on a given space
local function update_windows(space_id, ws_name, bundle_csv)
  local cache_key = space_id .. "." .. ws_name
  local icon_line = icons_for_bundles(bundle_csv)
  if spaces[space_id] and spaces[space_id][ws_name] and window_cache[cache_key] ~= icon_line then
    window_cache[cache_key] = icon_line
    spaces[space_id][ws_name]:set({ label = icon_line })
  end
end

-- Apply highlight style to a single workspace item
local function apply_style(item, is_selected)
  local icon_font = is_selected
    and { style = settings.font.style_map.bold, size = 16.0 }
    or { style = settings.font.style_map.regular, size = 16.0 }

  item:set({
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
      color = is_selected and highlight_tint or transparent,
    },
  })
end

-- Query workspaces for a space and update all items on that display
local function update_display(space_id)
  local cmd = "rift-cli query workspaces --space-id " .. space_id
    .. " | " .. JQ .. " -r '.[] | \"\\(.name)\\t\\(.is_active)\\t\\(.windows | map(.bundle_id) | join(\",\"))\"'"

  sbar.exec(cmd, function(output)
    if not output or output == "" then return end
    local found_active = nil

    for line in output:gmatch("[^\r\n]+") do
      local ws = parse_workspace_line(line)
      if ws and spaces[space_id] and spaces[space_id][ws.name] then
        update_windows(space_id, ws.name, ws.bundles)
        if ws.is_active then
          found_active = ws.name
        end
      end
    end

    -- Update highlighting
    if found_active then
      local prev = current_workspace[space_id]
      current_workspace[space_id] = found_active

      if not prev then
        -- First call: style all items
        for ws_name, item in pairs(spaces[space_id]) do
          apply_style(item, ws_name == found_active)
        end
      else
        if prev ~= found_active and spaces[space_id][prev] then
          apply_style(spaces[space_id][prev], false)
        end
        apply_style(spaces[space_id][found_active], true)
      end
    end
  end)
end

-- Main Setup: query displays, then create workspace items per display
local displays_cmd = "rift-cli query displays | " .. JQ .. " -r '.[] | \"\\(.screen_id)\\t\\(.space)\\t\\(.name)\"'"

sbar.exec(displays_cmd, function(output)
  if not output or output == "" then return end

  local display_list = {} -- { {screen_id=N, space_id=N, name=S}, ... }

  for line in output:gmatch("[^\r\n]+") do
    local screen_id, space_id, name = line:match("^([^\t]+)\t([^\t]+)\t(.+)$")
    if screen_id and space_id then
      table.insert(display_list, {
        screen_id = tonumber(screen_id),
        space_id = tonumber(space_id),
        name = name,
      })
    end
  end

  local workspace_names = { "1", "2", "3", "4", "5", "6", "7", "8", "9", "0" }

  for _, display in ipairs(display_list) do
    local sid = display.space_id
    local screen = display.screen_id
    spaces[sid] = {}

    for _, ws_name in ipairs(workspace_names) do
      -- Map workspace name to 0-based index for switch command
      local ws_index = tonumber(ws_name)
      if ws_index == nil then ws_index = 0
      elseif ws_name == "0" then ws_index = 9
      else ws_index = ws_index - 1
      end

      local item_name = "space." .. sid .. "." .. ws_name

      spaces[sid][ws_name] = sbar.add("item", item_name, {
        icon = {
          string = ws_name,
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
        display = screen,
        click_script = "rift-cli execute workspace switch " .. ws_index,
        position = "left",
      })

      -- Hover effects
      local item = spaces[sid][ws_name]
      local captured_sid = sid
      local captured_name = ws_name

      item:subscribe("mouse.entered", function(env)
        item:set({ background = { color = highlight_tint } })
      end)

      item:subscribe("mouse.exited", function(env)
        if captured_name ~= current_workspace[captured_sid] then
          item:set({ background = { color = transparent } })
        else
          item:set({ background = { color = highlight_tint } })
        end
      end)
    end
  end

  -- Separator (same as original)
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

  -- Front App (same as original)
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
    -- Refresh all displays to catch window moves
    for sid, _ in pairs(spaces) do
      update_display(sid)
    end
  end)

  front_app:subscribe("mouse.clicked", function(env)
    sbar.exec("open -a 'Mission Control'")
  end)

  -- Initial front_app label: pick focused window from any active workspace
  for _, display in ipairs(display_list) do
    local cmd = "rift-cli query workspaces --space-id " .. display.space_id
      .. " | " .. JQ .. " -r '[.[] | select(.is_active) | .windows[] | select(.is_focused)] | first | .bundle_id // empty'"
    sbar.exec(cmd, function(app_name)
      if app_name and app_name ~= "" then
        front_app:set({ label = app_name:gsub("%s+$", "") })
      end
    end)
  end

  -- Register custom SketchyBar events
  sbar.exec("sketchybar --add event rift_workspace_change")
  sbar.exec("sketchybar --add event rift_windows_change")

  -- Subscribe rift-cli to push events into SketchyBar
  sbar.exec('rift-cli subscribe cli --event workspace_changed --command sketchybar --args "--trigger rift_workspace_change"')
  sbar.exec('rift-cli subscribe cli --event windows_changed --command sketchybar --args "--trigger rift_windows_change"')

  -- Observer item for event handling
  local observer = sbar.add("item", "spaces_observer", { drawing = false, updates = true })

  observer:subscribe("rift_workspace_change", function(env)
    for sid, _ in pairs(spaces) do
      update_display(sid)
    end
  end)

  observer:subscribe("rift_windows_change", function(env)
    for sid, _ in pairs(spaces) do
      update_display(sid)
    end
  end)

  -- Initial population
  for sid, _ in pairs(spaces) do
    update_display(sid)
  end
end)

return spaces
