-- Markdown buffer legibility. NOTE: spell is disabled in config/autocmds.lua,
-- not here — LazyVim's lazyvim_wrap_spell FileType autocmd fires AFTER this
-- ftplugin and would override an opt_local.spell set here.

-- Hanging indent for soft-wrapped lines: continuation lines align under the
-- bullet text instead of snapping back to column 0 ('linebreak' is already on globally)
vim.opt_local.breakindent = true
vim.opt_local.breakindentopt = "list:-1"

-- Prose doesn't need jump targets; keep absolute numbers for navigation
vim.opt_local.relativenumber = false
