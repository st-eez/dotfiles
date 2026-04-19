local colors = require("colors")
local icons = require("icons")
local settings = require("settings")
local sbar = require("sketchybar")

local HOME = os.getenv("HOME") or ""
local script_path = debug.getinfo(1, "S").source:sub(2)
local config_dir = script_path:match("(.*/)[^/]+/[^/]+$") or ""
local helper = config_dir .. "helpers/agent_attention.sh"
local live_helper = HOME .. "/.config/sketchybar/helpers/agent_attention.sh"

-- Cap popup rows. Larger than realistic concurrent-agent count; extras are dropped.
local MAX_ROWS = 12

-- Per-char width estimate for JetBrainsMono Regular at label font size.
-- Row width is computed per-refresh from the longest string so hover
-- highlight spans the full row without over-reserving space.
local POPUP_CHAR_PX = 8
local POPUP_SIDE_PAD = 24
local POPUP_MIN_WIDTH = 160

local state = {
  hover = false,
  rows = {},
}

local agent_status -- forward decl

local function schedule_popup_close()
  sbar.exec("sleep 0.05", function()
    if not state.hover then
      agent_status:set({ popup = { drawing = false } })
    end
  end)
end

local popup_rows = {}

local function resolve_cmd()
  -- Prefer worktree-local helper when present (dev), fall back to the
  -- stowed live copy so the item works from either launch path.
  return string.format(
    "if [ -x %q ]; then %q; else %q; fi",
    helper, helper, live_helper
  )
end

local function parse_row(line)
  local pane, agent, st, name, loc = line:match("^([^\t]*)\t([^\t]*)\t([^\t]*)\t([^\t]*)\t([^\t]*)$")
  if not pane then return nil end
  return { pane = pane, agent = agent, state = st, name = name, loc = loc }
end

local function is_blocked(s) return s:sub(1, 8) == "blocked:" end
local function is_idle(s) return s == "idle" end
local function is_working(s) return s == "working" end

local function state_priority(s)
  if is_blocked(s) then return 0 end
  if is_idle(s) then return 1 end
  return 2
end

local function row_color(s)
  if is_blocked(s) then return colors.red end
  if is_idle(s) then return colors.white end
  return colors.green
end

-- tmux pane IDs are always `%<digits>`. Reject anything else to keep the shell
-- call below injection-safe.
local function safe_pane_id(p)
  return type(p) == "string" and p:match("^%%%d+$") ~= nil
end

local w_item, i_item, b_item

local cluster_members = {}

local function set_cluster_drawing(on)
  for _, it in ipairs(cluster_members) do
    it:set({ drawing = on })
  end
end

local function render(rows)
  local total = #rows
  if total == 0 then
    set_cluster_drawing(false)
    agent_status:set({ popup = { drawing = false } })
    for _, r in ipairs(popup_rows) do
      r:set({ drawing = false })
    end
    state.rows = {}
    return
  end

  local working, idle, blocked = 0, 0, 0
  for _, r in ipairs(rows) do
    if is_blocked(r.state) then
      blocked = blocked + 1
    elseif is_idle(r.state) then
      idle = idle + 1
    elseif is_working(r.state) then
      working = working + 1
    end
  end

  set_cluster_drawing(true)
  w_item:set({ label = { string = tostring(working) } })
  i_item:set({ label = { string = tostring(idle) } })
  b_item:set({ label = { string = tostring(blocked) } })

  for i, r in ipairs(rows) do r._i = i end
  table.sort(rows, function(a, b)
    local pa, pb = state_priority(a.state), state_priority(b.state)
    if pa ~= pb then return pa < pb end
    return a._i < b._i
  end)
  state.rows = rows

  local strings = {}
  local max_len = 0
  for i = 1, math.min(#rows, MAX_ROWS) do
    local r = rows[i]
    local s = string.format("%s %s %s", r.name, r.loc, r.state)
    strings[i] = s
    if #s > max_len then max_len = #s end
  end
  local row_width = math.max(POPUP_MIN_WIDTH, max_len * POPUP_CHAR_PX + POPUP_SIDE_PAD)

  for i, row in ipairs(popup_rows) do
    local r = rows[i]
    if r then
      row:set({
        drawing = true,
        label = {
          string = strings[i],
          color = row_color(r.state),
          width = row_width,
        },
      })
    else
      row:set({ drawing = false })
    end
  end
end

local function refresh()
  sbar.exec(resolve_cmd(), function(out)
    local rows = {}
    if out and out ~= "" then
      for line in out:gmatch("[^\r\n]+") do
        local r = parse_row(line)
        if r then table.insert(rows, r) end
      end
    end
    render(rows)
  end)
end

-- Count items. Added right-to-left (B first = rightmost). Each digit gets
-- its own color so the whole cluster reads `W·I·B` at a glance.
local function make_count_item(name, color)
  return sbar.add("item", name, {
    position = "right",
    drawing = false,
    icon = { drawing = false },
    label = {
      string = "0",
      color = color,
      padding_left = 3,
      padding_right = 3,
    },
    padding_left = 0,
    padding_right = 0,
  })
end

local function make_separator(name)
  return sbar.add("item", name, {
    position = "right",
    drawing = false,
    icon = { drawing = false },
    label = {
      string = "│",
      color = colors.grey,
      padding_left = 5,
      padding_right = 5,
    },
    padding_left = 0,
    padding_right = 0,
  })
end

-- Order: first add = rightmost. Visual reads icon|I│W│B left-to-right.
b_item = make_count_item("agent_status.b", colors.red)
local sep2 = make_separator("agent_status.sep2")
w_item = make_count_item("agent_status.w", colors.green)
local sep1 = make_separator("agent_status.sep1")
i_item = make_count_item("agent_status.i", colors.white)

-- Icon item (added last = leftmost of cluster). Carries the popup and the
-- 5s poll that catches spawn/close transitions the daemon's attention-set
-- trigger misses (working-only pane set changes).
agent_status = sbar.add("item", "agent_status", {
  position = "right",
  drawing = false,
  updates = true,
  update_freq = 5,
  icon = {
    string = icons.agent_bell,
    color = colors.white,
    font = { size = settings.font.size.glyph },
    padding_left = 8,
    padding_right = 2,
  },
  label = { drawing = false },
  padding_left = 0,
  padding_right = 0,
  popup = {
    align = "center",
    background = {
      border_width = 2,
      border_color = colors.grey,
    },
  },
})

cluster_members = { agent_status, w_item, sep1, i_item, sep2, b_item }

-- Pre-allocate popup rows; drawing flips per-refresh.
for i = 1, MAX_ROWS do
  local row = sbar.add("item", "agent_status.popup." .. i, {
    position = "popup.agent_status",
    drawing = false,
    icon = { drawing = false },
    label = {
      string = "",
      font = {
        family = settings.font.family,
        style = settings.font.style_map.regular,
        size = settings.font.size.label,
      },
      padding_left = 12,
      padding_right = 12,
      align = "left",
      width = POPUP_ROW_WIDTH,
    },
    background = {
      color = colors.transparent,
      height = settings.item.background.height,
      corner_radius = settings.item.background.corner_radius,
    },
    padding_left = 4,
    padding_right = 4,
  })

  row:subscribe("mouse.entered", function()
    state.hover = true
    row:set({ background = { color = colors.highlight } })
  end)

  row:subscribe("mouse.exited", function()
    row:set({ background = { color = colors.transparent } })
  end)

  row:subscribe("mouse.exited.global", function()
    state.hover = false
    schedule_popup_close()
  end)

  row:subscribe("mouse.clicked", function()
    local r = state.rows[i]
    if r and safe_pane_id(r.pane) then
      sbar.exec("tmux switch-client -t " .. r.pane, function()
        agent_status:set({ popup = { drawing = false } })
        sbar.exec("sketchybar --trigger agent_attention_changed")
      end)
    end
  end)

  popup_rows[i] = row
end

-- Main item interactions
agent_status:subscribe("mouse.entered", function()
  state.hover = true
end)

agent_status:subscribe("mouse.exited.global", function()
  state.hover = false
  schedule_popup_close()
end)

agent_status:subscribe("mouse.clicked", function(env)
  if env.BUTTON == "left" and #state.rows > 0 then
    agent_status:set({ popup = { drawing = "toggle" } })
  end
end)

-- Count items share hover tracking and forward clicks to the popup toggle.
for _, it in ipairs({ w_item, i_item, b_item }) do
  it:subscribe("mouse.entered", function() state.hover = true end)
  it:subscribe("mouse.exited.global", function()
    state.hover = false
    schedule_popup_close()
  end)
  it:subscribe("mouse.clicked", function(env)
    if env.BUTTON == "left" and #state.rows > 0 then
      agent_status:set({ popup = { drawing = "toggle" } })
    end
  end)
end

-- Daemon event + periodic poll + wake.
agent_status:subscribe("agent_attention_changed", refresh)
agent_status:subscribe("routine", refresh)
agent_status:subscribe("forced", refresh)
agent_status:subscribe("system_woke", refresh)

-- Bootstrap initial state (daemon only fires on change, so bar load needs a read).
refresh()

return agent_status
