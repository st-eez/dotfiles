local colors = require("colors")
local icons = require("icons")
local settings = require("settings")
local sbar = require("sketchybar")

-- State
local state = {
  status = "idle", -- idle | running | paused | done
  duration_secs = 0,
  remaining_secs = 0,
  target_epoch = 0,
  hover = false,
}

-- Helper Functions (declared early for use in callbacks)
local function format_time(secs)
  local m = math.floor(secs / 60)
  local s = secs % 60
  return string.format("%02d:%02d", m, s)
end

local timer -- forward declaration

local function update_label(secs)
  timer:set({ label = { drawing = true, string = format_time(secs), color = colors.blue } })
end

-- Close popup shortly after pointer leaves all timer/popup regions.
local function schedule_popup_close()
  sbar.exec("sleep 0.05", function()
    if not state.hover then
      timer:set({ popup = { drawing = false } })
    end
  end)
end

local function reset_to_idle()
  state.status = "idle"
  state.duration_secs = 0
  state.remaining_secs = 0
  state.target_epoch = 0
  timer:set({
    updates = false,
    update_freq = 0,
    popup = { drawing = false },
    label = { drawing = false, string = "", color = colors.white },
    icon = { color = colors.white },
  })
end

local function timer_complete()
  state.status = "done"
  timer:set({
    updates = false,
    update_freq = 0,
    popup = { drawing = false },
    label = { drawing = true, string = "Done!", color = colors.green },
    icon = { color = colors.green },
  })
  sbar.exec([[osascript -e 'display notification "Time'\''s up!" with title "Focus Timer"']])
end

local function start_timer(duration_secs)
  state.status = "running"
  state.duration_secs = duration_secs
  state.remaining_secs = duration_secs
  state.target_epoch = os.time() + duration_secs
  timer:set({
    popup = { drawing = false },
    updates = true,
    update_freq = 1,
    label = { drawing = true, string = format_time(duration_secs), color = colors.blue },
    icon = { color = colors.blue },
  })
end

-- Spacer for gap between betterdisplay and timer
sbar.add("item", "timer.spacer", {
  position = "right",
  width = 16,
  background = { drawing = false },
  icon = { drawing = false },
  label = { drawing = false },
})

-- Main Timer Item
timer = sbar.add("item", "timer", {
  position = "right",
  updates = false,
  update_freq = 0,
  icon = {
    string = icons.timer,
    color = colors.white,
    font = { size = 16.0 },
  },
  label = {
    drawing = false,
    string = "",
    padding_left = 4,
    padding_right = 4,
    width = 50,
    align = "center",
  },
  padding_left = 0,
  padding_right = 0,
  popup = {
    background = {
      border_width = 2,
      border_color = colors.grey,
    },
  }
})

-- Popup Duration Items
local durations = {
  { label = "15 min", secs = 900 },
  { label = "30 min", secs = 1800 },
  { label = "1 hour", secs = 3600 },
}

for _, dur in ipairs(durations) do
  local popup_item = sbar.add("item", "timer.popup." .. dur.secs, {
    position = "popup.timer",
    label = {
      string = dur.label,
      font = {
        family = settings.font.family,
        style = settings.font.style_map.bold,
        size = settings.font.size.label,
      },
      padding_left = 12,
      padding_right = 12,
    },
    icon = { drawing = false },
    background = {
      color = colors.transparent,
      height = settings.item.background.height,
      corner_radius = settings.item.background.corner_radius,
    },
    padding_left = 4,
    padding_right = 4,
  })

  popup_item:subscribe("mouse.clicked", function()
    start_timer(dur.secs)
  end)

  popup_item:subscribe("mouse.entered", function()
    state.hover = true
    popup_item:set({ background = { color = colors.highlight } })
  end)

  popup_item:subscribe("mouse.exited", function()
    popup_item:set({ background = { color = colors.transparent } })
  end)

  popup_item:subscribe("mouse.exited.global", function()
    state.hover = false
    schedule_popup_close()
  end)
end

-- Hover tracking for timer icon
timer:subscribe("mouse.entered", function()
  state.hover = true
end)

timer:subscribe("mouse.exited.global", function()
  state.hover = false
  schedule_popup_close()
end)

-- Click Handlers
timer:subscribe("mouse.clicked", function(env)
  if env.BUTTON == "left" then
    if state.status == "idle" then
      timer:set({ popup = { drawing = "toggle" } })
    elseif state.status == "running" then
      -- Pause
      state.remaining_secs = math.max(0, state.target_epoch - os.time())
      state.status = "paused"
      timer:set({
        updates = false,
        update_freq = 0,
        icon = { color = colors.yellow },
        label = { color = colors.yellow },
      })
    elseif state.status == "paused" then
      -- Resume
      state.target_epoch = os.time() + state.remaining_secs
      state.status = "running"
      timer:set({
        updates = true,
        update_freq = 1,
        icon = { color = colors.blue },
        label = { color = colors.blue },
      })
    elseif state.status == "done" then
      reset_to_idle()
    end
  elseif env.BUTTON == "right" then
    if state.status ~= "idle" then
      reset_to_idle()
    end
  end
end)

-- Update Loop
timer:subscribe("routine", function()
  if state.status == "running" then
    local remaining = math.max(0, state.target_epoch - os.time())
    if remaining <= 0 then
      timer_complete()
    else
      state.remaining_secs = remaining
      update_label(remaining)
    end
  end
end)

-- Wake Catch-up
timer:subscribe("system_woke", function()
  if state.status == "running" then
    local remaining = math.max(0, state.target_epoch - os.time())
    if remaining <= 0 then
      timer_complete()
    else
      state.remaining_secs = remaining
      update_label(remaining)
    end
  end
end)

return timer
