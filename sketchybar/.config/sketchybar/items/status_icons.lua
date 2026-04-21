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

-- Volume: icon-only. Native volume_change drives live updates; glyph and color
-- derive from effective volume (sketchybar collapses mute to 0, see src/volume.c).
-- Trade-off: volume=0 unmuted renders as muted/grey — rare and harmless.
local volume_icon = add_status_icon("status.volume", icons.volume.high, { icon_size = settings.font.size.glyph })

local function render_volume(n)
  local glyph, color
  if n == 0 then
    glyph, color = icons.volume.muted, colors.grey
  elseif n >= 66 then
    glyph, color = icons.volume.high, colors.white
  elseif n >= 33 then
    glyph, color = icons.volume.mid, colors.white
  else
    glyph, color = icons.volume.low, colors.white
  end
  volume_icon:set({ icon = { string = glyph, color = color } })
end

local function read_volume()
  sbar.exec(
    [[osascript -e 'set v to output volume of (get volume settings)' -e 'set m to output muted of (get volume settings)' -e 'if m then set v to 0' -e 'return v as text']],
    function(out)
      local n = out and tonumber(out:match("(%d+)"))
      if n then render_volume(n) end
    end
  )
end

volume_icon:subscribe("volume_change", function(env)
  local n = tonumber(env.INFO)
  if n then render_volume(n) end
end)

-- Toggle fires volume_change, which repaints.
volume_icon:subscribe("mouse.clicked", function()
  sbar.exec([[osascript -e 'set m to output muted of (get volume settings)' -e 'set volume output muted (not m)']])
end)

volume_icon:subscribe("system_woke", read_volume)
read_volume()
