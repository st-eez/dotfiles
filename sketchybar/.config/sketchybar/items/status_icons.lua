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

-- Volume: icon reflects mute/level; label shows %. Click icon to toggle mute.
local volume_icon = add_status_icon("status.volume", icons.volume.high, { icon_size = settings.font.size.glyph })
local volume_pct = sbar.add("item", "status.volume_pct", {
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
  update_freq = 5,
})

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
      volume_pct:set({ label = { string = v .. "%" } })
    end
  )
end

volume_icon:subscribe("mouse.clicked", function()
  sbar.exec(
    [[osascript -e 'set m to output muted of (get volume settings)' -e 'set volume output muted (not m)']],
    update_volume
  )
end)
volume_pct:subscribe({ "routine", "system_woke" }, update_volume)
update_volume()

-- Wifi: icon only. SSID is redacted by modern macOS without location perms, so we skip it.
local wifi_icon = add_status_icon("status.wifi", icons.wifi.on, { icon_size = settings.font.size.glyph, updates = true, update_freq = 15 })

local function update_wifi()
  sbar.exec("ifconfig en0 2>/dev/null", function(out)
    local up = out and out:find("status: active") ~= nil and out:find("inet ") ~= nil
    wifi_icon:set({ icon = { string = up and icons.wifi.on or icons.wifi.off, color = up and colors.white or colors.grey } })
  end)
end

wifi_icon:subscribe({ "routine", "system_woke" }, update_wifi)
update_wifi()

-- Mic: shown only while an audio input engine is live. Orange = in use.
local mic_icon = add_status_icon("status.mic", icons.mic, { icon_size = settings.font.size.glyph })
mic_icon:set({ drawing = false })

local function update_mic()
  sbar.exec([[ioreg -c AppleHDAEngineInput -r -d 1 2>/dev/null | grep -c 'IOAudioEngineState" = 1']], function(out)
    local active = (tonumber(out) or 0) > 0
    mic_icon:set({
      drawing = active,
      icon = { color = active and (colors.orange or colors.yellow) or colors.grey },
    })
  end)
end

mic_icon:subscribe({ "routine", "system_woke" }, update_mic)
update_mic()
