local icons = require("icons")
local colors = require("colors")
local settings = require("settings")
local sbar = require("sketchybar")

local apple = sbar.add("item", "apple", {
  icon = {
    string = icons.apple,
    color = colors.white,
    font = {
      size = 16.0,
    },
  },
  label = { drawing = false },
  padding_right = 10,
})
