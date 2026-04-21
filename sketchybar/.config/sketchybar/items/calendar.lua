local colors = require("colors")
local settings = require("settings")
local sbar = require("sketchybar")

local calendar = sbar.add("item", "calendar", {
  label = {
    font = {
      family = settings.font.family,
      style = settings.font.style_map.bold,
      size = settings.font.size.label,
    },
    padding_left = 5,
    padding_right = 10,
    color = colors.white,
  },
  position = "right",
  update_freq = 1, -- tick every second; label:set is gated on minute change below
  padding_left = 4,
  padding_right = 1,
  background = {
    color = colors.transparent,
    border_color = colors.transparent,
    border_width = 0,
  }
})

-- Cache the last painted label so the 1Hz tick only hits item:set on minute
-- change (60x/hr instead of 3600x/hr). os.date itself is sub-microsecond.
local last_label
local function update_time()
  -- Lua 5.5 strftime rejects GNU `%-d`/`%-I`, so strip zero-padding after the fact.
  -- Pattern ` 0(%d)` matches the leading zero of day and hour (space-prefixed) without
  -- touching minutes (colon-prefixed), producing e.g. "Fri Apr 8 3:05PM".
  local s = os.date("%a %b %d %I:%M%p"):gsub(" 0(%d)", " %1")
  if s ~= last_label then
    last_label = s
    calendar:set({ label = s })
  end
end

calendar:subscribe({ "routine", "system_woke" }, update_time)

-- initial paint
update_time()

return calendar
