local colors = require("colors")
local sbar = require("sketchybar")

-- Teams menu bar alias (new Teams bundle id is com.microsoft.teams2)
local teams_alias = "Control Center,com.microsoft.teams2"

local teams = sbar.add("alias", teams_alias, {
	position = "right",
	alias = {
		color = colors.white,
	},
	padding_left = 0,
	padding_right = 0,
	icon = {
		padding_left = 0,
		padding_right = 0,
	},
	label = {
		drawing = false,
		padding_left = 0,
		padding_right = 0,
	},
})

return teams
