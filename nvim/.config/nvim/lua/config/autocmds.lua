-- Autocmds are automatically loaded on the VeryLazy event
-- Default autocmds that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/autocmds.lua
--
-- Add any additional autocmds here
-- with `vim.api.nvim_create_autocmd`
--
-- Or remove existing autocmds by their group name (which is prefixed with `lazyvim_` for the defaults)
-- e.g. vim.api.nvim_del_augroup_by_name("lazyvim_wrap_spell")

-- Previewer-style markdown headings: bright bold text over a full-width
-- hairline rule, no colored bands or icons. render-markdown applies the
-- RenderMarkdownH*Bg group across the whole heading row (hl_eol), so an
-- underline-only definition renders as a rule instead of a band. Colors
-- derive from the active colorscheme, surviving theme-set switches.
local function markdown_heading_style()
  local fg = vim.api.nvim_get_hl(0, { name = "Normal", link = false }).fg
  local rule = vim.api.nvim_get_hl(0, { name = "LineNr", link = false }).fg
  -- Heading text color comes from treesitter, not the RenderMarkdownH* groups
  vim.api.nvim_set_hl(0, "@markup.heading", { fg = fg, bold = true })
  for level = 1, 6 do
    vim.api.nvim_set_hl(0, "RenderMarkdownH" .. level .. "Bg", { sp = rule, underline = true })
  end
end

vim.api.nvim_create_autocmd("ColorScheme", {
  group = vim.api.nvim_create_augroup("markdown_heading_style", { clear = true }),
  callback = markdown_heading_style,
})
-- The colorscheme is applied before VeryLazy loads this file, so apply once now too.
markdown_heading_style()

-- Disable spell in markdown: underlines are mostly false positives in
-- config-heavy prose (toggle back with <leader>us). Must be a FileType autocmd
-- registered AFTER LazyVim's lazyvim_wrap_spell (which forces spell = true and
-- fires after after/ftplugin/markdown.lua) — user autocmds load after LazyVim's,
-- so this one runs last and wins.
vim.api.nvim_create_autocmd("FileType", {
  group = vim.api.nvim_create_augroup("markdown_no_spell", { clear = true }),
  pattern = { "markdown" },
  callback = function()
    vim.opt_local.spell = false
  end,
})
