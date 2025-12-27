local colors = require("colors")

local settings = {
  font = {
    family = "JetBrainsMono Nerd Font",
    style_map = {
      regular = "Regular",
      bold = "Bold",
      semibold = "Semibold",
      heavy = "Heavy",
      black = "Black",
    },
    size = {
      icon = 14.0,
      label = 13.0,
    },
  },
  paddings = 1,
  bar = {
    height = 34,
    position = "top",
    sticky = true,
    topmost = true,
    padding_left = 20,
    padding_right = 10,
    margin = 0,
  },
  item = {
    background = {
      height = 26,
      corner_radius = 9,
      border_width = 2,
    },
    padding = {
      left = 1,
      right = 1,
    },
  },
  popup = {
    blur_radius = 20,
    background = {
      corner_radius = 9,
      border_width = 2,
    }
  },
  monitors = {
    -- Display assignment per monitor_id (as reported by AeroSpace) to SketchyBar display_id
    laptop_display = 1,
    default_profile = "home",
    profiles = {
      work = {
        match = "LG ULTRAWIDE",
        map = { [1] = 1, [2] = 3, [3] = 2 },
      },
      home = {
        match = "VG279QE5A",
        map = { [1] = 1, [2] = 2, [3] = 3 },
      },
    },
  },
}

return settings
