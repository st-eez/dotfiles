local colors = require("colors")
local settings = require("settings")
local sbar = require("sketchybar")

local control_center = sbar.add("item", "control_center", {
  icon = {
    string = "􀜊",
    font = {
      style = settings.font.style_map.regular,
      size = 16.0,
    },
    color = colors.white,
    padding_left = 4,
    padding_right = 4,
  },
  label = { drawing = false },
  position = "right",
  padding_left = 0,
  padding_right = 0,
})

return control_center
