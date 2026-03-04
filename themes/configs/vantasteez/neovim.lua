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
          colors.fg = "#eaeaea"
          colors.fg_dark = "#d6d6d6"
          colors.comment = "#8a8a8a"

          -- Keep Vantablack mapping semantics, swap in Vantasteez canonical palette.
          colors.red = "#c995a0"
          colors.red1 = "#c995a0"
          colors.orange = "#d4ad86"
          colors.yellow = "#d8c08a"
          colors.green = "#a3c8a0"
          colors.green1 = "#a3c8a0"
          colors.green2 = "#a3c8a0"
          colors.cyan = "#8fbfc8"
          colors.teal = "#8fbfc8"
          colors.blue = "#8fa8d8"
          colors.blue2 = "#8fbfc8"
          colors.magenta = "#b9a3d7"
          colors.magenta2 = "#b9a3d7"
          colors.purple = "#b9a3d7"

          -- Keep derived semantic colors aligned with the overridden canonical slots.
          colors.error = colors.red1
          colors.warning = colors.yellow
          colors.info = colors.blue2
          colors.hint = colors.teal
          colors.todo = colors.blue
        end,
      })

      -- NOTE: vantablack.nvim currently exposes on_highlights in config defaults
      -- but does not apply it internally, so enforce todo keyword readability here.
      local group = vim.api.nvim_create_augroup("VantasteezTodoHighlights", { clear = true })
      vim.api.nvim_create_autocmd("ColorScheme", {
        group = group,
        pattern = "vantablack",
        callback = function()
          vim.api.nvim_set_hl(0, "TodoBgWARN", { fg = "#eaeaea", bg = "NONE", bold = true })
          vim.api.nvim_set_hl(0, "TodoBgTODO", { fg = "#eaeaea", bg = "NONE", bold = true })
          vim.api.nvim_set_hl(0, "TodoBgFIX", { fg = "#eaeaea", bg = "NONE", bold = true })
          vim.api.nvim_set_hl(0, "TodoBgHACK", { fg = "#eaeaea", bg = "NONE", bold = true })
          vim.api.nvim_set_hl(0, "TodoBgNOTE", { fg = "#eaeaea", bg = "NONE", bold = true })
          vim.api.nvim_set_hl(0, "TodoBgPERF", { fg = "#eaeaea", bg = "NONE", bold = true })
          vim.api.nvim_set_hl(0, "TodoFgWARN", { fg = "#d8c08a", bold = true })
          vim.api.nvim_set_hl(0, "TodoFgTODO", { fg = "#8fa8d8", bold = true })
          vim.api.nvim_set_hl(0, "TodoFgFIX", { fg = "#c995a0", bold = true })
          vim.api.nvim_set_hl(0, "TodoFgHACK", { fg = "#d4ad86", bold = true })
          vim.api.nvim_set_hl(0, "TodoFgNOTE", { fg = "#8fbfc8", bold = true })
          vim.api.nvim_set_hl(0, "TodoFgPERF", { fg = "#b9a3d7", bold = true })
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
