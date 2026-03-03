-- Osaka Jade theme for Neovim (LazyVim)
-- Managed by theme-set, symlinked to ~/.config/nvim/lua/plugins/theme.lua
return {
  {
    "st-eez/osaka-jade.nvim",
    lazy = false,
    priority = 1000,
    dev = true,
  },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "osaka-jade",
    },
  },
}
