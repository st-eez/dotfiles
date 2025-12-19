local colors = require("colors")
local icons = require("icons")
local settings = require("settings")

local sbar = require("sketchybar")

sbar.bar({
  height = settings.bar.height,
  color = colors.bar.bg,
  border_width = 0,
  border_color = colors.bar.border,
  corner_radius = 0,
  shadow = false,
  position = settings.bar.position,
  sticky = settings.bar.sticky,
  topmost = settings.bar.topmost,
  padding_left = settings.bar.padding_left,
  padding_right = settings.bar.padding_right,
  margin = settings.bar.margin,
})

sbar.default({
  updates = "when_shown",
  icon = {
    font = {
      family = settings.font.family,
      style = settings.font.style_map.bold,
      size = settings.font.size.icon,
    },
    color = colors.white,
    padding_left = settings.paddings,
    padding_right = settings.paddings,
  },
  label = {
    font = {
      family = settings.font.family,
      style = settings.font.style_map.regular,
      size = settings.font.size.label,
    },
    color = colors.white,
    padding_left = settings.paddings,
    padding_right = settings.paddings,
    y_offset = 0,
  },
  padding_right = settings.paddings,
  padding_left = settings.paddings,
  background = {
    height = settings.item.background.height,
    corner_radius = settings.item.background.corner_radius,
    border_width = settings.item.background.border_width,
    color = colors.transparent,
  },
  popup = {
    background = {
      border_width = settings.popup.background.border_width,
      corner_radius = settings.popup.background.corner_radius,
      border_color = colors.popup.border,
      color = colors.popup.bg,
      shadow = { drawing = true },
    },
    blur_radius = settings.popup.blur_radius,
  },
})

-- Load Items
require("items.apple")
require("items.spaces")
require("items.calendar")
require("items.control_center")
require("items.status_icons")
require("items.betterdisplay")
require("items.timer")

-- Hotload configuration
sbar.exec("sketchybar --hotload true")
