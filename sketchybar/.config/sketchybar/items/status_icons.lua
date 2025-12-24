local colors = require("colors")
local icons = require("icons")
local sbar = require("sketchybar")

local function add_status_icon(name, icon, opts)
  opts = opts or {}
  local icon_padding_left = opts.icon_padding_left or 10
  local icon_padding_right = opts.icon_padding_right or 10
  local icon_size = opts.icon_size or 14.0
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

local battery_icon = add_status_icon("status.battery", icons.battery, { icon_padding_left = 2, icon_size = 16.0 })

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
add_status_icon("status.wifi", icons.wifi)
add_status_icon("status.volume", icons.volume)
add_status_icon("status.teams", icons.teams)
