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
  if is_blocked(s) then return colors.yellow end
  if is_idle(s) then return colors.white end
  return colors.green
end

-- tmux pane IDs are always `%<digits>`. Reject anything else to keep the shell
-- call below injection-safe.
local function safe_pane_id(p)
  return type(p) == "string" and p:match("^%%%d+$") ~= nil
end

local function render(rows)
  local total = #rows
  if total == 0 then
    agent_status:set({
      drawing = false,
      popup = { drawing = false },
    })
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

  local color
  if blocked > 0 then
    color = colors.yellow
  elseif idle > 0 then
    color = colors.white
  else
    color = colors.green
  end

  agent_status:set({
    drawing = true,
    icon = { color = color },
    label = {
      drawing = true,
      string = string.format("%d\194\183%d\194\183%d", working, idle, blocked),
      color = color,
    },
  })

  for i, r in ipairs(rows) do r._i = i end
  table.sort(rows, function(a, b)
    local pa, pb = state_priority(a.state), state_priority(b.state)
    if pa ~= pb then return pa < pb end
    return a._i < b._i
  end)
  state.rows = rows

  for i, row in ipairs(popup_rows) do
    local r = rows[i]
    if r then
      row:set({
        drawing = true,
        label = {
          string = string.format("%s %s %s", r.name, r.loc, r.state),
          color = row_color(r.state),
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

-- Main item. update_freq polls every 5s to catch spawn/close transitions the
-- daemon's attention-set trigger misses (working-only pane set changes).
agent_status = sbar.add("item", "agent_status", {
  position = "right",
  drawing = false,
  updates = true,
  update_freq = 5,
  icon = {
    string = icons.agent_bell,
    color = colors.green,
    font = { size = settings.font.size.glyph },
    padding_left = 8,
    padding_right = 2,
  },
  label = {
    drawing = true,
    string = "0\194\1830\194\1830",
    padding_left = 2,
    padding_right = 8,
  },
  padding_left = 0,
  padding_right = 0,
  popup = {
    align = "right",
    background = {
      border_width = 2,
      border_color = colors.grey,
    },
  },
})

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

-- Daemon event + periodic poll + wake.
agent_status:subscribe("agent_attention_changed", refresh)
agent_status:subscribe("routine", refresh)
agent_status:subscribe("forced", refresh)
agent_status:subscribe("system_woke", refresh)

-- Bootstrap initial state (daemon only fires on change, so bar load needs a read).
refresh()

return agent_status
