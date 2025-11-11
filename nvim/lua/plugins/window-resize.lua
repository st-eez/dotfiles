return {
  {
    "LazyVim/LazyVim",
    keys = function(_, keys)
      -- Disable native Ctrl+arrow bindings (reserved for Aerospace)
      local del = { "<C-Up>", "<C-Down>", "<C-Left>", "<C-Right>" }
      for _, lhs in ipairs(del) do
        table.insert(keys, { lhs, false })
      end

      -- Use Ctrl+Opt+arrows for window resizing
      local map = {
        {
          "<C-A-Left>",
          "<cmd>vertical resize -5<cr>",
          desc = "Decrease Window Width",
        },
        {
          "<C-A-Right>",
          "<cmd>vertical resize +5<cr>",
          desc = "Increase Window Width",
        },
        {
          "<C-A-Down>",
          "<cmd>resize -5<cr>",
          desc = "Decrease Window Height",
        },
        {
          "<C-A-Up>",
          "<cmd>resize +5<cr>",
          desc = "Increase Window Height",
        },
      }
      vim.list_extend(keys, map)
      return keys
    end,
  },
}
