-- Vantarouge theme for Neovim (LazyVim)
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

          -- Keep Vantablack mapping semantics, swap in Vantarouge canonical palette.
          colors.red = "#c94f4f"
          colors.red1 = "#c94f4f"
          colors.orange = "#aa7462"
          colors.yellow = "#ad9168"
          colors.green = "#879b78"
          colors.green1 = "#879b78"
          colors.green2 = "#879b78"
          colors.cyan = "#809996"
          colors.teal = "#809996"
          colors.blue = "#858fa8"
          colors.blue2 = "#809996"
          colors.magenta = "#9f748d"
          colors.magenta2 = "#9f748d"
          colors.purple = "#9f748d"

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
      local group = vim.api.nvim_create_augroup("VantarougeTodoHighlights", { clear = true })
      vim.api.nvim_create_autocmd("ColorScheme", {
        group = group,
        pattern = "vantablack",
        callback = function()
          -- Fix near-invisible Visual selection (upstream #191919 on #0d0d0d)
          vim.api.nvim_set_hl(0, "Visual", { bg = "#342020" })
          vim.api.nvim_set_hl(0, "TodoBgWARN", { fg = "#eaeaea", bg = "NONE", bold = true })
          vim.api.nvim_set_hl(0, "TodoBgTODO", { fg = "#eaeaea", bg = "NONE", bold = true })
          vim.api.nvim_set_hl(0, "TodoBgFIX", { fg = "#eaeaea", bg = "NONE", bold = true })
          vim.api.nvim_set_hl(0, "TodoBgHACK", { fg = "#eaeaea", bg = "NONE", bold = true })
          vim.api.nvim_set_hl(0, "TodoBgNOTE", { fg = "#eaeaea", bg = "NONE", bold = true })
          vim.api.nvim_set_hl(0, "TodoBgPERF", { fg = "#eaeaea", bg = "NONE", bold = true })
          vim.api.nvim_set_hl(0, "TodoFgWARN", { fg = "#ad9168", bold = true })
          vim.api.nvim_set_hl(0, "TodoFgTODO", { fg = "#858fa8", bold = true })
          vim.api.nvim_set_hl(0, "TodoFgFIX", { fg = "#c94f4f", bold = true })
          vim.api.nvim_set_hl(0, "TodoFgHACK", { fg = "#aa7462", bold = true })
          vim.api.nvim_set_hl(0, "TodoFgNOTE", { fg = "#809996", bold = true })
          vim.api.nvim_set_hl(0, "TodoFgPERF", { fg = "#9f748d", bold = true })
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
