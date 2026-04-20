-- Regression test for agent_status.lua's parse_row + short_sid helpers.
-- Extracts the two pure functions from the item file (they don't touch the
-- sketchybar API) and exercises them against sample TSV rows that match the
-- helper's output contract.

local function read_file(path)
  local f = assert(io.open(path, "r"))
  local s = f:read("*a")
  f:close()
  return s
end

local script_dir = arg[0]:match("(.*/)") or "./"
local item_path = script_dir .. "../items/agent_status.lua"
local src = read_file(item_path)

-- Pull out the two helpers as a self-contained chunk.
local parse_src = src:match("local function parse_row%b()\n.-\nend") or error("parse_row not found")
local sid_src = src:match("local function short_sid%b()\n.-\nend") or error("short_sid not found")

local chunk = parse_src .. "\n" .. sid_src .. "\nreturn parse_row, short_sid"
local loader = assert(load(chunk, "parse_row_chunk"))
local parse_row, short_sid = loader()

local fails = 0
local function check(name, cond, msg)
  if not cond then
    fails = fails + 1
    io.stderr:write("FAIL " .. name .. ": " .. (msg or "") .. "\n")
  end
end

-- Populated detail.session_id.
local a = parse_row("%42\tcodex\tidle\tsteez\tMac:1.1\t019da911-81f8-7721-99ea-b622f3ea4391")
check("populated row parses", a ~= nil)
check("populated pane", a.pane == "%42", a and a.pane)
check("populated agent", a.agent == "codex")
check("populated state", a.state == "idle")
check("populated name", a.name == "steez")
check("populated loc", a.loc == "Mac:1.1")
check("populated session_id", a.session_id == "019da911-81f8-7721-99ea-b622f3ea4391")

-- Blocked state with colon in value.
local b = parse_row("%57\tren\tblocked:question\tren-alpha\tMac:2.3\ta4fc19d7-ad1e-44fe-9b8f-42cb4c0ddebf")
check("blocked row parses", b ~= nil)
check("blocked state includes reason", b.state == "blocked:question", b and b.state)

-- Missing tmux loc + missing session_id (trailing empty fields).
local c = parse_row("%99\tren\tblocked:question\tren-beta\t?:?.?\t")
check("empty-session row parses", c ~= nil)
check("empty-session loc fallback", c.loc == "?:?.?", c and c.loc)
check("empty-session session_id is empty", c.session_id == "", c and c.session_id)

-- Malformed input (wrong column count) returns nil.
check("5-column input rejected", parse_row("%1\tren\tidle\tfoo\tMac:1.1") == nil)

-- short_sid behaviour.
check("short_sid of full uuid", short_sid("019da911-81f8-7721-99ea-b622f3ea4391") == "019da911")
check("short_sid of empty", short_sid("") == "-")
check("short_sid of nil", short_sid(nil) == "-")

if fails > 0 then
  io.stderr:write(string.format("%d check(s) failed\n", fails))
  os.exit(1)
end
print("ok: parse_row + short_sid match helper output contract")
