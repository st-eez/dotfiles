#!/usr/bin/env lua

local handle = io.popen("sketchybar --query bar")
local result = handle and handle:read("*a") or ""
if handle then handle:close() end

-- Parse the hidden state more defensively (accepts quoted or bare values).
local hidden = result:match('"hidden"%s*:%s*"?(%w+)"?')

if hidden == "off" then
  os.execute("sketchybar --bar hidden=on")
elseif hidden == "on" then
  os.execute("sketchybar --bar hidden=off topmost=on")
else
  io.stderr:write("Could not read SketchyBar hidden state; no action taken\n")
end
