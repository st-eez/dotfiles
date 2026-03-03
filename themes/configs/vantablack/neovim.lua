-- Vantablack theme for Neovim (LazyVim)
-- Managed by theme-set, symlinked to ~/.config/nvim/lua/plugins/theme.lua
return {
  {
    "bjarneo/vantablack.nvim",
    lazy = false,
    priority = 1000,
  },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "vantablack",
    },
  },
}
