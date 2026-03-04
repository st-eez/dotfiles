-- Vantasteez theme for Neovim (LazyVim)
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
          colors.bg = "#0d0d0d"
          colors.bg_dark = "#0d0d0d"
          colors.bg_dark1 = "#0d0d0d"
          colors.bg_highlight = "#1a1a1a"
          colors.blue0 = "#2d3448"
          colors.blue7 = "#202535"

          colors.fg = "#f2f2f2"
          colors.fg_dark = "#d8d8d8"
          colors.fg_gutter = "#555555"
          colors.comment = "#8d8d8d"
          colors.dark3 = "#5f5f5f"
          colors.dark5 = "#8a8a8a"
          colors.terminal_black = "#505050"

          colors.red = "#d68392"
          colors.red1 = "#e09dac"
          colors.orange = "#dc9d77"
          colors.yellow = "#c8a87a"
          colors.green = "#9dbc7b"
          colors.green1 = "#a8c48b"
          colors.green2 = "#a8c48b"
          colors.cyan = "#87bcdc"
          colors.teal = "#87bcdc"
          colors.blue = "#859fd6"
          colors.blue1 = "#9bb0e0"
          colors.blue2 = "#87bcdc"
          colors.blue5 = "#8d8d8d"
          colors.blue6 = "#9bb0e0"
          colors.magenta = "#af9ad6"
          colors.magenta2 = "#b5a2d9"
          colors.purple = "#af9ad6"
          colors.special_char = "#b5a2d9"
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
