local colors = require("colors")
local settings = require("settings")
local sbar = require("sketchybar")

local rift_settings = settings.rift or {}
local assignments = rift_settings.workspace_assignments or {}
local display_map = rift_settings.screen_to_sketchybar_display or {}
local refresh_seconds = rift_settings.refresh_seconds or 2
local global_workspace_script = rift_settings.global_workspace_script or "$HOME/.config/rift/scripts/global-workspace.sh"

local spaces = {}
local active_workspaces = {}
local front_app = nil

local active_color = colors.white
local inactive_color = colors.grey
local highlight_tint = colors.highlight or 0x337aa2f7
local transparent = colors.transparent

local function apply_style(global_workspace, is_selected)
	local item = spaces[global_workspace]
	if not item then
		return
	end

	active_workspaces[global_workspace] = is_selected and true or nil
	local icon_font = is_selected
		and { style = settings.font.style_map.bold, size = 16.0 }
		or { style = settings.font.style_map.regular, size = 16.0 }

	item:set({
		icon = {
			highlight = is_selected,
			font = icon_font,
			padding_left = 12,
			padding_right = 2,
		},
		label = {
			highlight = is_selected,
			color = is_selected and active_color or inactive_color,
			padding_left = 4,
			padding_right = 18,
		},
		background = {
			border_color = transparent,
			color = is_selected and highlight_tint or transparent,
		},
	})
end

local function refresh_front_app()
	if not front_app then
		return
	end

	sbar.exec("rift-cli query windows 2>/dev/null | jq -r '.[] | select(.is_focused == true) | .app_name // empty' | head -n 1", function(app_name)
		local clean_name = (app_name or ""):gsub("[%s\r\n]+$", "")
		front_app:set({ label = clean_name })
	end)
end

local function refresh_highlights()
	local active_locals_by_screen = {}
	local pending = 0

	local function apply_all()
		if pending > 0 then
			return
		end

		for _, assignment in ipairs(assignments) do
			local active_local = active_locals_by_screen[assignment.screen_id]
			local is_selected = active_local ~= nil and active_local == assignment.local_index
			apply_style(assignment.global, is_selected)
		end
	end

	sbar.exec("rift-cli query displays 2>/dev/null | jq -r '.[] | [.screen_id, (.active_space_ids[0] // empty)] | @tsv'", function(display_rows)
		for row in (display_rows or ""):gmatch("[^\r\n]+") do
			local screen_id_str, space_id_str = row:match("([^\t]+)\t([^\t]+)")
			local screen_id = tonumber(screen_id_str)
			local space_id = tonumber(space_id_str)
			if screen_id and space_id then
				pending = pending + 1
				local cmd = "rift-cli query workspaces --space-id " .. space_id .. " 2>/dev/null | jq -r '.[] | select(.is_active == true) | .index' | head -n 1"
				sbar.exec(cmd, function(active_idx)
					local local_index = tonumber((active_idx or ""):match("%d+"))
					if local_index ~= nil then
						active_locals_by_screen[screen_id] = local_index
					end
					pending = pending - 1
					apply_all()
				end)
			end
		end

		apply_all()
	end)
end

local function refresh_state()
	refresh_highlights()
	refresh_front_app()
end

for _, assignment in ipairs(assignments) do
	local global_workspace = assignment.global
	local display_id = display_map[assignment.screen_id] or assignment.screen_id
	local click_script = global_workspace_script .. " " .. global_workspace .. " switch"

	spaces[global_workspace] = sbar.add("item", "space." .. global_workspace, {
		icon = {
			string = global_workspace,
			color = inactive_color,
			highlight_color = active_color,
			padding_left = 6,
			padding_right = 0,
			font = { family = settings.font.family, style = settings.font.style_map.regular, size = 14.0 },
		},
		label = {
			string = "",
			color = inactive_color,
			highlight_color = colors.white,
			font = { family = settings.font.family, style = settings.font.style_map.regular, size = 13.0 },
			y_offset = -1,
			padding_right = 10,
		},
		background = {
			color = transparent,
			border_color = transparent,
		},
		display = display_id,
		click_script = click_script,
		position = "left",
	})

	spaces[global_workspace]:subscribe("mouse.entered", function()
		spaces[global_workspace]:set({ background = { color = highlight_tint } })
	end)

	spaces[global_workspace]:subscribe("mouse.exited", function()
		if active_workspaces[global_workspace] then
			spaces[global_workspace]:set({ background = { color = highlight_tint } })
		else
			spaces[global_workspace]:set({ background = { color = transparent } })
		end
	end)
end

sbar.add("item", "space_separator", {
	icon = {
		string = "􀆊",
		font = { size = 14.0, style = "Black" },
		color = colors.white,
		padding_left = 10,
		padding_right = 8,
	},
	label = { drawing = false },
	position = "left",
	padding_left = 0,
	padding_right = 0,
})

front_app = sbar.add("item", "front_app", {
	icon = { drawing = false },
	label = {
		font = {
			family = settings.font.family,
			style = settings.font.style_map.bold,
			size = 13.0,
		},
	},
	display = "active",
	position = "left",
	updates = true,
})

front_app:subscribe("front_app_switched", function()
	refresh_front_app()
end)

front_app:subscribe("mouse.clicked", function()
	sbar.exec("open -a 'Mission Control'")
end)

local spaces_observer = sbar.add("item", "spaces_observer", {
	drawing = false,
	updates = true,
	update_freq = refresh_seconds,
})

spaces_observer:subscribe("routine", function()
	refresh_state()
end)

spaces_observer:subscribe("display_change", function()
	refresh_state()
end)

spaces_observer:subscribe("space_change", function()
	refresh_state()
end)

refresh_state()

return spaces
