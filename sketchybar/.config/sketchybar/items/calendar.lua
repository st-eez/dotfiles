local colors = require("colors")
local settings = require("settings")
local sbar = require("sketchybar")

local calendar = sbar.add("item", "calendar", {
  label = {
    font = {
      family = settings.font.family,
      style = settings.font.style_map.bold,
      size = 13.0,
    },
    padding_left = 5,
    padding_right = 10,
    color = colors.white,
  },
  position = "right",
  update_freq = 30, -- refresh every 30 seconds; still accurate, less churn
  padding_left = 4,
  padding_right = 1,
  background = {
    color = colors.transparent,
    border_color = colors.transparent,
    border_width = 0,
  }
})

local function update_time()
  local now = os.date("*t")
  local hour = now.hour % 12
  if hour == 0 then hour = 12 end
  local ampm = now.hour >= 12 and "PM" or "AM"
  local label = string.format("%s %s %d %d:%02d%s",
    os.date("%a"),
    os.date("%b"),
    now.day,
    hour,
    now.min,
    ampm
  )
  calendar:set({ label = label })
end

calendar:subscribe({ "routine", "system_woke" }, update_time)

-- initial paint
update_time()

return calendar
