local colors = require("colors")
local icons = require("icons")
local settings = require("settings")
local sbar = require("sketchybar")

local function add_status_icon(name, icon, opts)
  opts = opts or {}
  local icon_padding_left = opts.icon_padding_left or 10
  local icon_padding_right = opts.icon_padding_right or 10
  local icon_size = opts.icon_size or settings.font.size.icon
  return sbar.add("item", name, {
    position = "right",
    icon = {
      string = icon,
      color = colors.white,
      font = { size = icon_size },
      padding_left = icon_padding_left,
      padding_right = icon_padding_right,
    },
    label = opts.label or { drawing = false },
    padding_left = 0,
    padding_right = 0,
    updates = opts.updates,
    update_freq = opts.update_freq,
  })
end

local battery_icon = add_status_icon("status.battery", icons.battery, { icon_padding_left = 2, icon_size = settings.font.size.glyph })

local battery_pct = sbar.add("item", "status.battery_pct", {
  position = "right",
  icon = { drawing = false },
  label = {
    drawing = true,
    string = "--%",
    color = colors.white,
    padding_left = 10,
    padding_right = 2,
  },
  padding_left = 0,
  padding_right = 0,
  updates = true,
  update_freq = 60,
})

local function update_battery()
  sbar.exec("pmset -g batt", function(out)
    local pct = out and out:match("(%d?%d?%d)%%")
    if pct then
      battery_pct:set({ label = { string = pct .. "%" } })
    end

    local on_ac = out and out:find("AC Power") ~= nil
    local icon = on_ac and icons.battery_charging or icons.battery
    battery_icon:set({ icon = { string = icon } })
  end)
end

battery_pct:subscribe({ "routine", "system_woke", "power_source_change" }, update_battery)
update_battery()

-- Volume: icon-only. Click to toggle mute. Refreshes on wake and on click;
-- intentionally no routine poll — media-key changes won't update the glyph
-- mid-session, but the bar stays quiet and there's no CPU tax.
local volume_icon = add_status_icon("status.volume", icons.volume.high, { icon_size = settings.font.size.glyph })

local function update_volume()
  sbar.exec(
    [[osascript -e 'set v to output volume of (get volume settings)' -e 'set m to output muted of (get volume settings)' -e 'return (v as text) & "|" & (m as text)']],
    function(out)
      if not out then return end
      local v, m = out:match("(%d+)|(%a+)")
      if not v then return end
      local n = tonumber(v) or 0
      local muted = (m == "true")
      local glyph
      if muted or n == 0 then
        glyph = icons.volume.muted
      elseif n >= 66 then
        glyph = icons.volume.high
      elseif n >= 33 then
        glyph = icons.volume.mid
      else
        glyph = icons.volume.low
      end
      volume_icon:set({ icon = { string = glyph, color = muted and colors.grey or colors.white } })
    end
  )
end

volume_icon:subscribe("mouse.clicked", function()
  sbar.exec(
    [[osascript -e 'set m to output muted of (get volume settings)' -e 'set volume output muted (not m)']],
    update_volume
  )
end)
volume_icon:subscribe("system_woke", update_volume)
update_volume()
