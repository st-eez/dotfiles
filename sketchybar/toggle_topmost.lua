#!/usr/bin/env lua

local handle = io.popen("sketchybar --query bar")
local result = handle:read("*a")
handle:close()

-- Basic JSON parsing to find the hidden state
local hidden = result:match('"hidden":%s*"([^"]*)"')

if hidden == "off" then
  os.execute("sketchybar --bar hidden=on")
else
  os.execute("sketchybar --bar hidden=off topmost=on")
end