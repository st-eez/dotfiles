-- Everforest Dark theme for Neovim (LazyVim)
-- Managed by theme-set, symlinked to ~/.config/nvim/lua/plugins/theme.lua
return {
  {
    "sainnhe/everforest",
    lazy = false,
    priority = 1000,
    config = function()
      vim.g.everforest_background = "medium"
    end,
  },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "everforest",
    },
  },
}
