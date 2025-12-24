local colors = require("colors")
local sbar = require("sketchybar")

local battery = sbar.add("alias", "Control Center,Battery", {
  position = "right",
  alias = {
    color = colors.white,
  },
  padding_left = 0,
  padding_right = 0,
  icon = {
    padding_left = 0,
    padding_right = 0,
  },
  label = {
    padding_left = 0,
    padding_right = 0,
  },
})

return battery