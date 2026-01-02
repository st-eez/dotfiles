---@diagnostic disable: undefined-global
-- Osaka Jade colorscheme for Neovim
-- Canonical source: https://github.com/basecamp/omarchy/tree/master/themes/osaka-jade
-- All colors from omarchy ghostty.conf, kitty.conf, alacritty.toml

vim.cmd("hi clear")
if vim.fn.exists("syntax_on") then
  vim.cmd("syntax reset")
end
vim.o.termguicolors = true
vim.g.colors_name = "osaka-jade"

-- =============================================================================
-- Palette (canonical from omarchy)
-- =============================================================================
local c = {
  -- Primary colors
  bg = "#111c18",
  fg = "#C1C497",
  cursor = "#D7C995",

  -- Normal colors (ANSI 0-7)
  black = "#23372B",
  red = "#FF5345",
  green = "#549e6a",
  yellow = "#459451", -- Note: omarchy color3 is dark green, NOT yellow
  blue = "#509475", -- jade-tinted
  magenta = "#D2689C",
  cyan = "#2DD5B7",
  white = "#F6F5DD",

  -- Bright colors (ANSI 8-15)
  bright_black = "#53685B", -- comment/muted
  bright_red = "#db9f9c",
  bright_green = "#63b07a",
  bright_yellow = "#E5C736", -- actual yellow
  bright_blue = "#ACD4CF",
  bright_magenta = "#75bbb3",
  bright_cyan = "#8CD3CB",
  bright_white = "#9eebb3",

  -- Derived (for UI elements)
  bg1 = "#1a2520", -- secondary background
  bg2 = "#23372B", -- tertiary background
  bg3 = "#2a3530", -- borders

  -- Semantic aliases
  comment = "#53685B",
  selection = "#23372B",
  none = "NONE",
}

-- =============================================================================
-- Terminal colors (ANSI 0-15)
-- =============================================================================
vim.g.terminal_color_0 = c.black
vim.g.terminal_color_1 = c.red
vim.g.terminal_color_2 = c.green
vim.g.terminal_color_3 = c.yellow
vim.g.terminal_color_4 = c.blue
vim.g.terminal_color_5 = c.magenta
vim.g.terminal_color_6 = c.cyan
vim.g.terminal_color_7 = c.white
vim.g.terminal_color_8 = c.bright_black
vim.g.terminal_color_9 = c.bright_red
vim.g.terminal_color_10 = c.bright_green
vim.g.terminal_color_11 = c.bright_yellow
vim.g.terminal_color_12 = c.bright_blue
vim.g.terminal_color_13 = c.bright_magenta
vim.g.terminal_color_14 = c.bright_cyan
vim.g.terminal_color_15 = c.bright_white

-- =============================================================================
-- Helper function
-- =============================================================================
local function hi(group, opts)
  vim.api.nvim_set_hl(0, group, opts)
end

-- =============================================================================
-- Editor highlights
-- =============================================================================
hi("Normal", { fg = c.fg, bg = c.bg })
hi("NormalFloat", { fg = c.fg, bg = c.bg1 })
hi("FloatBorder", { fg = c.cyan, bg = c.bg1 })
hi("FloatTitle", { fg = c.cyan, bg = c.bg1, bold = true })
hi("Cursor", { fg = c.bg, bg = c.cursor })
hi("CursorLine", { bg = c.bg1 })
hi("CursorColumn", { bg = c.bg1 })
hi("ColorColumn", { bg = c.bg1 })
hi("LineNr", { fg = c.bright_black })
hi("CursorLineNr", { fg = c.bright_yellow, bold = true })
hi("SignColumn", { fg = c.bright_black, bg = c.bg })
hi("VertSplit", { fg = c.bg2 })
hi("WinSeparator", { fg = c.bg2 })
hi("Folded", { fg = c.bright_black, bg = c.bg1 })
hi("FoldColumn", { fg = c.bright_black, bg = c.bg })
hi("NonText", { fg = c.bg2 })
hi("SpecialKey", { fg = c.bg2 })
hi("Whitespace", { fg = c.bg2 })

hi("Pmenu", { fg = c.fg, bg = c.bg1 })
hi("PmenuSel", { fg = c.bg, bg = c.cyan })
hi("PmenuSbar", { bg = c.bg2 })
hi("PmenuThumb", { bg = c.bright_black })

hi("StatusLine", { fg = c.fg, bg = c.bg1 })
hi("StatusLineNC", { fg = c.bright_black, bg = c.bg1 })
hi("TabLine", { fg = c.bright_black, bg = c.bg1 })
hi("TabLineFill", { bg = c.bg1 })
hi("TabLineSel", { fg = c.fg, bg = c.bg, bold = true })
hi("WinBar", { fg = c.fg, bg = c.bg })
hi("WinBarNC", { fg = c.bright_black, bg = c.bg })

hi("Visual", { bg = c.selection })
hi("VisualNOS", { bg = c.selection })
hi("Search", { fg = c.bg, bg = c.bright_yellow })
hi("IncSearch", { fg = c.bg, bg = c.cyan })
hi("CurSearch", { fg = c.bg, bg = c.cyan })
hi("Substitute", { fg = c.bg, bg = c.red })

hi("MatchParen", { fg = c.bright_yellow, bold = true, underline = true })
hi("ModeMsg", { fg = c.fg, bold = true })
hi("MsgArea", { fg = c.fg })
hi("MoreMsg", { fg = c.cyan })
hi("Question", { fg = c.cyan })
hi("WarningMsg", { fg = c.bright_yellow })
hi("ErrorMsg", { fg = c.red })

hi("Directory", { fg = c.cyan })
hi("Title", { fg = c.cyan, bold = true })
hi("Conceal", { fg = c.bright_black })
hi("qfLineNr", { fg = c.bright_black })
hi("QuickFixLine", { bg = c.bg1 })

-- =============================================================================
-- Syntax highlights
-- =============================================================================
hi("Comment", { fg = c.comment, italic = true })
hi("Constant", { fg = c.bright_magenta })
hi("String", { fg = c.green })
hi("Character", { fg = c.green })
hi("Number", { fg = c.magenta })
hi("Boolean", { fg = c.magenta })
hi("Float", { fg = c.magenta })

hi("Identifier", { fg = c.fg })
hi("Function", { fg = c.blue })

hi("Statement", { fg = c.cyan })
hi("Conditional", { fg = c.cyan })
hi("Repeat", { fg = c.cyan })
hi("Label", { fg = c.cyan })
hi("Operator", { fg = c.cyan })
hi("Keyword", { fg = c.cyan })
hi("Exception", { fg = c.red })

hi("PreProc", { fg = c.cyan })
hi("Include", { fg = c.cyan })
hi("Define", { fg = c.cyan })
hi("Macro", { fg = c.cyan })
hi("PreCondit", { fg = c.cyan })

hi("Type", { fg = c.bright_yellow })
hi("StorageClass", { fg = c.bright_yellow })
hi("Structure", { fg = c.bright_yellow })
hi("Typedef", { fg = c.bright_yellow })

hi("Special", { fg = c.bright_cyan })
hi("SpecialChar", { fg = c.bright_cyan })
hi("Tag", { fg = c.cyan })
hi("Delimiter", { fg = c.fg })
hi("SpecialComment", { fg = c.comment })
hi("Debug", { fg = c.red })

hi("Underlined", { underline = true })
hi("Bold", { bold = true })
hi("Italic", { italic = true })
hi("Ignore", { fg = c.bg })
hi("Error", { fg = c.red })
hi("Todo", { fg = c.bright_yellow, bg = c.bg1, bold = true })

-- =============================================================================
-- Treesitter highlights
-- =============================================================================
hi("@variable", { fg = c.fg })
hi("@variable.builtin", { fg = c.red })
hi("@variable.parameter", { fg = c.bright_blue })
hi("@variable.member", { fg = c.bright_cyan })

hi("@constant", { fg = c.bright_magenta })
hi("@constant.builtin", { fg = c.magenta })
hi("@constant.macro", { fg = c.magenta })

hi("@module", { fg = c.bright_cyan })
hi("@label", { fg = c.cyan })

hi("@string", { fg = c.green })
hi("@string.escape", { fg = c.bright_cyan })
hi("@string.special", { fg = c.bright_cyan })
hi("@string.regexp", { fg = c.bright_cyan })

hi("@character", { fg = c.green })
hi("@character.special", { fg = c.bright_cyan })

hi("@boolean", { fg = c.magenta })
hi("@number", { fg = c.magenta })
hi("@number.float", { fg = c.magenta })

hi("@type", { fg = c.bright_yellow })
hi("@type.builtin", { fg = c.bright_yellow })
hi("@type.definition", { fg = c.bright_yellow })

hi("@attribute", { fg = c.cyan })
hi("@property", { fg = c.bright_cyan })

hi("@function", { fg = c.blue })
hi("@function.builtin", { fg = c.cyan })
hi("@function.call", { fg = c.blue })
hi("@function.macro", { fg = c.cyan })
hi("@function.method", { fg = c.blue })
hi("@function.method.call", { fg = c.blue })

hi("@constructor", { fg = c.bright_yellow })
hi("@operator", { fg = c.cyan })

hi("@keyword", { fg = c.cyan })
hi("@keyword.coroutine", { fg = c.cyan })
hi("@keyword.function", { fg = c.cyan })
hi("@keyword.operator", { fg = c.cyan })
hi("@keyword.import", { fg = c.cyan })
hi("@keyword.storage", { fg = c.cyan })
hi("@keyword.repeat", { fg = c.cyan })
hi("@keyword.return", { fg = c.cyan })
hi("@keyword.debug", { fg = c.red })
hi("@keyword.exception", { fg = c.red })
hi("@keyword.conditional", { fg = c.cyan })
hi("@keyword.directive", { fg = c.cyan })
hi("@keyword.directive.define", { fg = c.cyan })

hi("@punctuation.delimiter", { fg = c.fg })
hi("@punctuation.bracket", { fg = c.fg })
hi("@punctuation.special", { fg = c.cyan })

hi("@comment", { fg = c.comment, italic = true })
hi("@comment.documentation", { fg = c.comment })
hi("@comment.error", { fg = c.red })
hi("@comment.warning", { fg = c.bright_yellow })
hi("@comment.todo", { fg = c.bright_yellow, bold = true })
hi("@comment.note", { fg = c.cyan })

hi("@markup.strong", { bold = true })
hi("@markup.italic", { italic = true })
hi("@markup.strikethrough", { strikethrough = true })
hi("@markup.underline", { underline = true })

hi("@markup.heading", { fg = c.cyan, bold = true })
hi("@markup.quote", { fg = c.comment, italic = true })
hi("@markup.math", { fg = c.cyan })

hi("@markup.link", { fg = c.bright_cyan, underline = true })
hi("@markup.link.label", { fg = c.green })
hi("@markup.link.url", { fg = c.bright_cyan, underline = true })

hi("@markup.raw", { fg = c.bright_yellow })
hi("@markup.raw.block", { fg = c.fg })

hi("@markup.list", { fg = c.cyan })
hi("@markup.list.checked", { fg = c.green })
hi("@markup.list.unchecked", { fg = c.bright_black })

hi("@diff.plus", { fg = c.green })
hi("@diff.minus", { fg = c.red })
hi("@diff.delta", { fg = c.bright_blue })

hi("@tag", { fg = c.cyan })
hi("@tag.attribute", { fg = c.bright_cyan })
hi("@tag.delimiter", { fg = c.fg })

-- =============================================================================
-- LSP highlights
-- =============================================================================
hi("DiagnosticError", { fg = c.red })
hi("DiagnosticWarn", { fg = c.bright_yellow })
hi("DiagnosticInfo", { fg = c.cyan })
hi("DiagnosticHint", { fg = c.bright_cyan })
hi("DiagnosticOk", { fg = c.green })

hi("DiagnosticUnderlineError", { undercurl = true, sp = c.red })
hi("DiagnosticUnderlineWarn", { undercurl = true, sp = c.bright_yellow })
hi("DiagnosticUnderlineInfo", { undercurl = true, sp = c.cyan })
hi("DiagnosticUnderlineHint", { undercurl = true, sp = c.bright_cyan })
hi("DiagnosticUnderlineOk", { undercurl = true, sp = c.green })

hi("DiagnosticVirtualTextError", { fg = c.red, bg = c.bg1 })
hi("DiagnosticVirtualTextWarn", { fg = c.bright_yellow, bg = c.bg1 })
hi("DiagnosticVirtualTextInfo", { fg = c.cyan, bg = c.bg1 })
hi("DiagnosticVirtualTextHint", { fg = c.bright_cyan, bg = c.bg1 })

hi("DiagnosticFloatingError", { fg = c.red })
hi("DiagnosticFloatingWarn", { fg = c.bright_yellow })
hi("DiagnosticFloatingInfo", { fg = c.cyan })
hi("DiagnosticFloatingHint", { fg = c.bright_cyan })

hi("DiagnosticSignError", { fg = c.red })
hi("DiagnosticSignWarn", { fg = c.bright_yellow })
hi("DiagnosticSignInfo", { fg = c.cyan })
hi("DiagnosticSignHint", { fg = c.bright_cyan })

hi("LspReferenceText", { bg = c.bg2 })
hi("LspReferenceRead", { bg = c.bg2 })
hi("LspReferenceWrite", { bg = c.bg2 })

hi("LspSignatureActiveParameter", { fg = c.cyan, bold = true })
hi("LspCodeLens", { fg = c.comment })
hi("LspCodeLensSeparator", { fg = c.comment })

hi("LspInlayHint", { fg = c.comment, bg = c.bg1 })

-- =============================================================================
-- Git highlights
-- =============================================================================
hi("DiffAdd", { bg = "#15241c" })
hi("DiffChange", { bg = "#1a2520" })
hi("DiffDelete", { bg = "#241515" })
hi("DiffText", { bg = "#2a3530" })

hi("diffAdded", { fg = c.green })
hi("diffRemoved", { fg = c.red })
hi("diffChanged", { fg = c.bright_blue })
hi("diffOldFile", { fg = c.bright_yellow })
hi("diffNewFile", { fg = c.green })
hi("diffFile", { fg = c.cyan })
hi("diffLine", { fg = c.comment })
hi("diffIndexLine", { fg = c.magenta })

-- GitSigns
hi("GitSignsAdd", { fg = c.green })
hi("GitSignsChange", { fg = c.bright_blue })
hi("GitSignsDelete", { fg = c.red })
hi("GitSignsCurrentLineBlame", { fg = c.comment })

-- =============================================================================
-- Plugin highlights
-- =============================================================================

-- Telescope
hi("TelescopeNormal", { fg = c.fg, bg = c.bg1 })
hi("TelescopeBorder", { fg = c.cyan, bg = c.bg1 })
hi("TelescopeTitle", { fg = c.cyan, bold = true })
hi("TelescopePromptNormal", { fg = c.fg, bg = c.bg1 })
hi("TelescopePromptBorder", { fg = c.cyan, bg = c.bg1 })
hi("TelescopePromptTitle", { fg = c.cyan, bold = true })
hi("TelescopePromptPrefix", { fg = c.cyan })
hi("TelescopeResultsNormal", { fg = c.fg, bg = c.bg1 })
hi("TelescopeResultsBorder", { fg = c.cyan, bg = c.bg1 })
hi("TelescopeResultsTitle", { fg = c.cyan, bold = true })
hi("TelescopePreviewNormal", { fg = c.fg, bg = c.bg1 })
hi("TelescopePreviewBorder", { fg = c.cyan, bg = c.bg1 })
hi("TelescopePreviewTitle", { fg = c.cyan, bold = true })
hi("TelescopeSelection", { fg = c.fg, bg = c.bg2 })
hi("TelescopeSelectionCaret", { fg = c.cyan })
hi("TelescopeMatching", { fg = c.cyan, bold = true })

-- Neo-tree
hi("NeoTreeNormal", { fg = c.fg, bg = c.bg })
hi("NeoTreeNormalNC", { fg = c.fg, bg = c.bg })
hi("NeoTreeDirectoryName", { fg = c.cyan })
hi("NeoTreeDirectoryIcon", { fg = c.cyan })
hi("NeoTreeRootName", { fg = c.cyan, bold = true })
hi("NeoTreeFileName", { fg = c.fg })
hi("NeoTreeFileIcon", { fg = c.fg })
hi("NeoTreeFileNameOpened", { fg = c.cyan })
hi("NeoTreeIndentMarker", { fg = c.bg2 })
hi("NeoTreeGitAdded", { fg = c.green })
hi("NeoTreeGitConflict", { fg = c.red })
hi("NeoTreeGitDeleted", { fg = c.red })
hi("NeoTreeGitIgnored", { fg = c.comment })
hi("NeoTreeGitModified", { fg = c.bright_blue })
hi("NeoTreeGitUnstaged", { fg = c.bright_yellow })
hi("NeoTreeGitUntracked", { fg = c.bright_yellow })
hi("NeoTreeGitStaged", { fg = c.green })
hi("NeoTreeFloatBorder", { fg = c.cyan })
hi("NeoTreeFloatTitle", { fg = c.cyan })
hi("NeoTreeCursorLine", { bg = c.bg1 })

-- WhichKey
hi("WhichKey", { fg = c.cyan })
hi("WhichKeyGroup", { fg = c.magenta })
hi("WhichKeyDesc", { fg = c.fg })
hi("WhichKeySeperator", { fg = c.comment })
hi("WhichKeySeparator", { fg = c.comment })
hi("WhichKeyFloat", { bg = c.bg1 })
hi("WhichKeyBorder", { fg = c.cyan, bg = c.bg1 })
hi("WhichKeyValue", { fg = c.comment })

-- Notify
hi("NotifyERRORBorder", { fg = c.red })
hi("NotifyWARNBorder", { fg = c.bright_yellow })
hi("NotifyINFOBorder", { fg = c.cyan })
hi("NotifyDEBUGBorder", { fg = c.comment })
hi("NotifyTRACEBorder", { fg = c.magenta })
hi("NotifyERRORIcon", { fg = c.red })
hi("NotifyWARNIcon", { fg = c.bright_yellow })
hi("NotifyINFOIcon", { fg = c.cyan })
hi("NotifyDEBUGIcon", { fg = c.comment })
hi("NotifyTRACEIcon", { fg = c.magenta })
hi("NotifyERRORTitle", { fg = c.red })
hi("NotifyWARNTitle", { fg = c.bright_yellow })
hi("NotifyINFOTitle", { fg = c.cyan })
hi("NotifyDEBUGTitle", { fg = c.comment })
hi("NotifyTRACETitle", { fg = c.magenta })
hi("NotifyERRORBody", { fg = c.fg })
hi("NotifyWARNBody", { fg = c.fg })
hi("NotifyINFOBody", { fg = c.fg })
hi("NotifyDEBUGBody", { fg = c.fg })
hi("NotifyTRACEBody", { fg = c.fg })

-- Noice
hi("NoiceCmdline", { fg = c.fg })
hi("NoiceCmdlineIcon", { fg = c.cyan })
hi("NoiceCmdlinePopup", { fg = c.fg, bg = c.bg1 })
hi("NoiceCmdlinePopupBorder", { fg = c.cyan })
hi("NoiceConfirm", { fg = c.fg, bg = c.bg1 })
hi("NoiceConfirmBorder", { fg = c.cyan })

-- Indent Blankline
hi("IblIndent", { fg = c.bg2 })
hi("IblScope", { fg = c.bright_black })

-- Mini
hi("MiniStatuslineDevinfo", { fg = c.fg, bg = c.bg2 })
hi("MiniStatuslineFileinfo", { fg = c.fg, bg = c.bg2 })
hi("MiniStatuslineFilename", { fg = c.fg, bg = c.bg1 })
hi("MiniStatuslineInactive", { fg = c.comment, bg = c.bg1 })
hi("MiniStatuslineModeCommand", { fg = c.bg, bg = c.bright_yellow, bold = true })
hi("MiniStatuslineModeInsert", { fg = c.bg, bg = c.green, bold = true })
hi("MiniStatuslineModeNormal", { fg = c.bg, bg = c.cyan, bold = true })
hi("MiniStatuslineModeOther", { fg = c.bg, bg = c.bright_cyan, bold = true })
hi("MiniStatuslineModeReplace", { fg = c.bg, bg = c.red, bold = true })
hi("MiniStatuslineModeVisual", { fg = c.bg, bg = c.magenta, bold = true })

-- Flash
hi("FlashLabel", { fg = c.bg, bg = c.cyan, bold = true })
hi("FlashMatch", { fg = c.fg, bg = c.bg2 })
hi("FlashCurrent", { fg = c.fg, bg = c.selection })

-- Cmp
hi("CmpItemAbbr", { fg = c.fg })
hi("CmpItemAbbrDeprecated", { fg = c.comment, strikethrough = true })
hi("CmpItemAbbrMatch", { fg = c.cyan, bold = true })
hi("CmpItemAbbrMatchFuzzy", { fg = c.cyan, bold = true })
hi("CmpItemKind", { fg = c.bright_yellow })
hi("CmpItemMenu", { fg = c.comment })

-- Lazy
hi("LazyButton", { fg = c.fg, bg = c.bg2 })
hi("LazyButtonActive", { fg = c.bg, bg = c.cyan })
hi("LazyComment", { fg = c.comment })
hi("LazyH1", { fg = c.bg, bg = c.cyan, bold = true })
hi("LazyH2", { fg = c.cyan, bold = true })
hi("LazyNormal", { fg = c.fg, bg = c.bg })
hi("LazyProgressDone", { fg = c.cyan })
hi("LazyProgressTodo", { fg = c.bg2 })
hi("LazySpecial", { fg = c.bright_cyan })

-- Mason
hi("MasonNormal", { fg = c.fg, bg = c.bg })
hi("MasonHeader", { fg = c.bg, bg = c.cyan, bold = true })
hi("MasonHeaderSecondary", { fg = c.bg, bg = c.bright_cyan, bold = true })
hi("MasonHighlight", { fg = c.cyan })
hi("MasonHighlightBlock", { fg = c.bg, bg = c.cyan })
hi("MasonHighlightBlockBold", { fg = c.bg, bg = c.cyan, bold = true })
hi("MasonHighlightSecondary", { fg = c.bright_cyan })
hi("MasonMuted", { fg = c.comment })
hi("MasonMutedBlock", { fg = c.comment, bg = c.bg1 })

-- Dashboard / Alpha
hi("DashboardHeader", { fg = c.cyan })
hi("DashboardCenter", { fg = c.fg })
hi("DashboardShortCut", { fg = c.bright_cyan })
hi("DashboardFooter", { fg = c.comment })

-- Trouble
hi("TroubleNormal", { fg = c.fg, bg = c.bg })
hi("TroubleCount", { fg = c.magenta })
hi("TroubleText", { fg = c.fg })

-- Navic (breadcrumbs)
hi("NavicText", { fg = c.fg })
hi("NavicSeparator", { fg = c.comment })
hi("NavicIconsFile", { fg = c.fg })
hi("NavicIconsModule", { fg = c.bright_cyan })
hi("NavicIconsNamespace", { fg = c.bright_cyan })
hi("NavicIconsPackage", { fg = c.bright_cyan })
hi("NavicIconsClass", { fg = c.bright_yellow })
hi("NavicIconsMethod", { fg = c.blue })
hi("NavicIconsProperty", { fg = c.bright_cyan })
hi("NavicIconsField", { fg = c.bright_cyan })
hi("NavicIconsConstructor", { fg = c.bright_yellow })
hi("NavicIconsEnum", { fg = c.bright_yellow })
hi("NavicIconsInterface", { fg = c.bright_yellow })
hi("NavicIconsFunction", { fg = c.blue })
hi("NavicIconsVariable", { fg = c.fg })
hi("NavicIconsConstant", { fg = c.magenta })
hi("NavicIconsString", { fg = c.green })
hi("NavicIconsNumber", { fg = c.magenta })
hi("NavicIconsBoolean", { fg = c.magenta })
hi("NavicIconsArray", { fg = c.bright_cyan })
hi("NavicIconsObject", { fg = c.bright_cyan })
hi("NavicIconsKey", { fg = c.cyan })
hi("NavicIconsNull", { fg = c.magenta })
hi("NavicIconsEnumMember", { fg = c.bright_cyan })
hi("NavicIconsStruct", { fg = c.bright_yellow })
hi("NavicIconsEvent", { fg = c.bright_yellow })
hi("NavicIconsOperator", { fg = c.cyan })
hi("NavicIconsTypeParameter", { fg = c.bright_yellow })
