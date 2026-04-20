-- Regression test for agent_status.lua's refresh trigger wiring.
-- Asserts the item is event-driven (agent_attention_changed + system_woke +
-- bootstrap) and no longer depends on the 5s `routine` poll for live
-- working/idle transitions. Source-level check so the test runs without the
-- sketchybar runtime.

local function read_file(path)
  local f = assert(io.open(path, "r"))
  local s = f:read("*a")
  f:close()
  return s
end

local script_dir = arg[0]:match("(.*/)") or "./"
local item_path = script_dir .. "../items/agent_status.lua"
local src = read_file(item_path)

local fails = 0
local function check(name, cond, msg)
  if not cond then
    fails = fails + 1
    io.stderr:write("FAIL " .. name .. ": " .. (msg or "") .. "\n")
  end
end

-- Primary live trigger: daemon + steez runtime hooks both fire this.
check(
  "subscribes to agent_attention_changed",
  src:find('subscribe%("agent_attention_changed"', 1, false) ~= nil
)

-- Wake behavior must stay wired.
check(
  "subscribes to system_woke",
  src:find('subscribe%("system_woke"', 1, false) ~= nil
)

-- 5s routine poll must be gone — this is the regression gate.
check(
  "does not subscribe to routine",
  src:find('subscribe%("routine"', 1, false) == nil,
  "routine subscription still present"
)

-- update_freq must either be absent or a slow heartbeat (>= 60s).
-- The 5s poll is what we're removing; anything faster than 60s defeats the
-- point of cutting the routine refresh.
local freq_str = src:match("update_freq%s*=%s*(%d+)")
if freq_str then
  local freq = tonumber(freq_str)
  check(
    "update_freq is a slow heartbeat or absent",
    freq and freq >= 60,
    string.format("update_freq=%s must be >=60 or removed", tostring(freq))
  )
end

-- Bootstrap: item must do one initial read at load so the bar shows current
-- state before any trigger fires. The `refresh()` call at top-level is the
-- bootstrap; guard against accidental removal.
--
-- Match: a bare `refresh()` statement at line start, not inside a function
-- body. The pattern anchors on a newline so `subscribe(..., refresh)` (which
-- just passes the function value) does not satisfy it.
check(
  "bootstrap refresh() call at top level",
  src:find("\nrefresh%(%)", 1, false) ~= nil
)

if fails > 0 then
  io.stderr:write(string.format("%d check(s) failed\n", fails))
  os.exit(1)
end
print("ok: agent_status.lua is event-driven (no 5s routine poll)")
