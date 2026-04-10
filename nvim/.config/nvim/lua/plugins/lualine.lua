return {
  "nvim-lualine/lualine.nvim",
  opts = function(_, opts)
    -- Lualine's "auto" theme finds vantablack.nvim's bundled lualine theme
    -- (lua/lualine/themes/vantablack.lua) which hardcodes colors.yellow for
    -- normal mode. Resolve it here and override before passing as a table,
    -- so lualine never re-resolves "auto" back to the bundled theme.
    local ok, theme = pcall(require, "lualine.themes.vantablack")
    if not ok then
      theme = require("lualine.themes.auto")
    end
    theme.normal.a = { fg = "#0d0d0d", bg = "#8fbfc8", gui = "bold" }
    theme.normal.b = { fg = "#8fbfc8", bg = theme.normal.b.bg }
    opts.options.theme = theme
  end,
}
