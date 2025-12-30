-- Gruvbox Dark Hard theme for Neovim (LazyVim)
-- Managed by theme-set, symlinked to ~/.config/nvim/lua/plugins/theme.lua
return {
  {
    "ellisonleao/gruvbox.nvim",
    lazy = false,
    priority = 1000,
    config = function()
      require("gruvbox").setup({
        contrast = "hard",
      })
    end,
  },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "gruvbox",
    },
  },
}
