local colors = require("colors")
local icons = require("icons")
local settings = require("settings")
local sbar = require("sketchybar")

-- Mirror the macOS Control Center volume item as an alias
local volume_alias = sbar.add("alias", "Control Center,Sound", {
  position = "right",
  alias = {
    color = colors.white,
  },
  icon = {
    padding_left = 6,
    padding_right = 4,
  },
  label = { drawing = false },
  background = {
    color = colors.transparent,
    padding_left = 0,
    padding_right = 0,
  },
})

return volume_alias
