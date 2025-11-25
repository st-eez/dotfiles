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

front_app:subscribe("front_app_switched", function(env)
  front_app:set({ label = env.INFO })
end)

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