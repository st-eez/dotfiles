return {
  {
    "LazyVim/LazyVim",
    keys = function(_, keys)
      local del = { "<C-Left>", "<C-Right>" }
      for _, lhs in ipairs(del) do
        table.insert(keys, { lhs, false })
      end

      local map = {
        {
          "<D-C-M-_>",
          "<cmd>vertical resize -5<cr>",
          desc = "Hyper Shrink Window Width",
        },
        {
          "<D-C-M-+>",
          "<cmd>vertical resize +5<cr>",
          desc = "Hyper Grow Window Width",
        },
      }
      vim.list_extend(keys, map)
      return keys
    end,
  },
}
