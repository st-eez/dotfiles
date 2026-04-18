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
  -- Lua 5.5 strftime rejects GNU `%-d`/`%-I`, so strip zero-padding after the fact.
  -- Pattern ` 0(%d)` matches the leading zero of day and hour (space-prefixed) without
  -- touching minutes (colon-prefixed), producing e.g. "Fri Apr 8 3:05PM".
  calendar:set({ label = (os.date("%a %b %d %I:%M%p"):gsub(" 0(%d)", " %1")) })
end

calendar:subscribe({ "routine", "system_woke" }, update_time)

-- initial paint
update_time()

return calendar
