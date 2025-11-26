local colors = require("colors")
local icons = require("icons")
local sbar = require("sketchybar")

-- Add a spacer to create a fixed gap between Teams and BetterDisplay
local spacer = sbar.add("item", "betterdisplay.spacer", {
  position = "right",
  width = 8,
  background = { drawing = false },
  icon = { drawing = false },
  label = { drawing = false },
})

local betterdisplay = sbar.add("item", "betterdisplay", {
  position = "right",
  icon = {
    string = icons.display,
    color = colors.white,
    padding_left = 0,
    padding_right = 0,
    font = {
      size = 14.0,
    },
  },
  label = { drawing = false },
  padding_left = 0,
  padding_right = 0,
  background = {
    color = colors.transparent,
    padding_left = 0,
    padding_right = 0,
  },
})

return betterdisplay