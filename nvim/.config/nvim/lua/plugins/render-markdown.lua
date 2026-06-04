return {
  -- Richer in-editor markdown rendering (LazyVim's markdown extra strips this down)
  {
    "MeanderingProgrammer/render-markdown.nvim",
    opts = {
      heading = {
        -- Previewer-style headings: conceal the `#` marks without drawing icons.
        -- "inline" conceals the marker and inserts the icon; an empty icon inserts nothing.
        position = "inline",
        icons = { "" },
      },
      code = {
        -- LazyVim already sets width = "block", right_pad = 1
        left_pad = 1,
        -- Breathing room inside `inline code` chips
        inline_pad = 1,
      },
    },
  },
}
