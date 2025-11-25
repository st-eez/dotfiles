local colors = require("colors")
local settings = require("settings")
local sbar = require("sketchybar")

local front_app = sbar.add("item", "front_app", {
  icon = { drawing = false },
  label = {
    font = {
      style = settings.font.style_map.bold,
      size = 13.0,
    },
  },
  display = "active",
  position = "left",
  updates = true,
})

-- Ensure ordering stays after the spaces separator once it exists
local function ensure_order()
  sbar.exec("sketchybar --move front_app after space_separator")
end

ensure_order()

front_app:subscribe("front_app_switched", function(env)
  front_app:set({ label = env.INFO })
end)

-- Re-assert ordering as the bar updates
front_app:subscribe({ "routine", "aerospace_workspace_change" }, ensure_order)

front_app:subscribe("mouse.clicked", function(env)
  sbar.exec("open -a 'Mission Control'")
end)

-- Initial update to populate the label immediately
sbar.exec("aerospace list-windows --focused --format '%{app-name}'", function(app_name)
  if app_name then
    front_app:set({ label = app_name:gsub("\n", "") })
  end
end)

return front_app
