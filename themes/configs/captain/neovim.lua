-- Captain theme for Neovim (LazyVim)
-- Managed by theme-set, symlinked to ~/.config/nvim/lua/plugins/theme.lua
return {
  {
    "bjarneo/vantablack.nvim",
    lazy = false,
    priority = 1000,
    config = function()
      require("vantablack").setup({
        styles = {
          comments = { italic = true },
          keywords = { italic = true },
          functions = {},
          variables = {},
        },
        on_colors = function(colors)
          colors.bg = "#050506"
          colors.bg_dark = "#050506"
          colors.bg_dark1 = "#050506"
          colors.bg_highlight = "#151518"
          colors.fg = "#f4f4f5"
          colors.fg_dark = "#d4d4d8"
          colors.comment = "#a1a1aa"

          -- Vantablack mapping semantics, captain canonical palette.
          colors.red = "#d06f82"
          colors.orange = "#d4ad86"
          colors.yellow = "#f59e0b"
          colors.green = "#7da876"
          colors.cyan = "#8ba888"
          colors.blue = "#38bdf8"
          colors.magenta = "#7c6faf"
        end,
      })
    end,
  },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "vantablack",
    },
  },
}
