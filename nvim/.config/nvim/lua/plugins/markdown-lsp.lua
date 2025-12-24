return {
  -- Disable markdown linter (prevents MD013 line-length errors)
  {
    "mfussenegger/nvim-lint",
    opts = {
      linters_by_ft = {
        markdown = {},
      },
    },
  },
}
