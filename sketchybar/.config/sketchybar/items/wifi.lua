local colors = require("colors")
local sbar = require("sketchybar")

local wifi = sbar.add("alias", "Control Center,WiFi", {
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

return wifi