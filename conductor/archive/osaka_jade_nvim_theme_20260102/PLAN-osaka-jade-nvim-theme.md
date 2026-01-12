# Osaka Jade Neovim Theme - Syntax Highlighting Overhaul

**Created:** 2026-01-02
**Status:** ✅ COMPLETED - Implementation verified by Oracle
**Validated:** 2026-01-02 (Oracle review - all claims verified against source)
**Completed:** 2026-01-02
**Location:** `/Users/stevedimakos/Projects/Personal/osaka-jade.nvim/`

---

## Executive Summary

The current Osaka Jade Neovim theme suffers from "jade soup" - too many syntax elements use similar green colors, resulting in poor visual differentiation. This plan applies a hierarchical syntax highlighting pattern inspired by established themes like Tokyo Night and Catppuccin to the Osaka Jade palette.

### The Problem

| Issue                | Current State                   | Impact               |
| -------------------- | ------------------------------- | -------------------- |
| Keywords & Functions | Both use `#509475` (Jade Teal)  | No visual separation |
| Strings & Operators  | Both use `#549e6a` (Muted Jade) | Everything blends    |
| Limited accent usage | Pink and Cyan underutilized     | Monotone appearance  |

### The Solution

Apply a **hierarchical syntax highlighting pattern** — inspired by established themes like Tokyo Night and Catppuccin — to the Osaka Jade palette. Each semantic category gets a distinct color.

---

## Color Palette Reference

### Main Colors (Jade Family)

| Name         | Hex       | HSL          | Visual Role                          |
| ------------ | --------- | ------------ | ------------------------------------ |
| Bright Mint  | `#2DD5B7` | 168° 68% 51% | **Primary accent** - keywords, links |
| Bright Green | `#63b07a` | 140° 30% 54% | **Light jade** - strings             |
| Muted Jade   | `#549e6a` | 140° 30% 47% | **Mid jade** - types, classes        |
| Jade Teal    | `#509475` | 150° 30% 45% | **Blue-tinted** - functions, methods |
| Forest Green | `#459451` | 130° 37% 43% | **Darkest jade** - operators         |

### Accent Colors

| Name          | Hex       | HSL          | Visual Role                          |
| ------------- | --------- | ------------ | ------------------------------------ |
| Pink          | `#D2689C` | 335° 52% 62% | **Warm accent** - numbers, constants |
| Red           | `#FF5345` | 4° 100% 63%  | **Errors only**                      |
| Bright Yellow | `#E5C736` | 48° 77% 56%  | **Warnings, cursor line number**     |
| Cream         | `#C1C497` | 61° 26% 68%  | **Foreground text**                  |
| Grey          | `#53685B` | 145° 11% 37% | **Comments**                         |

### Background

| Name         | Hex       | Purpose                 |
| ------------ | --------- | ----------------------- |
| Dark Forest  | `#111c18` | Primary background      |
| Secondary BG | `#1a2520` | Float/popup backgrounds |
| Tertiary BG  | `#23372B` | Selection, highlights   |

---

## The Mapping (Hierarchical Syntax Pattern)

This structure is inspired by established themes like Tokyo Night and Catppuccin for syntax highlighting:

| Syntax Category       | Color Assignment | Osaka Jade Hex | Rationale                                                            |
| --------------------- | ---------------- | -------------- | -------------------------------------------------------------------- |
| **Keywords**          | Primary Accent   | `#2DD5B7`      | `function`, `if`, `var`, `for`, `return` - brightest color draws eye |
| **Strings**           | Light Green      | `#63b07a`      | User content stands out but isn't jarring                            |
| **Functions/Methods** | Blue-tinted      | `#509475`      | Callable items have consistent treatment                             |
| **Types/Classes**     | Mid Green        | `#549e6a`      | Structure definitions slightly muted                                 |
| **Variables**         | Foreground       | `#C1C497`      | Default text color - most common element                             |
| **Numbers/Constants** | Warm Accent      | `#D2689C`      | Rare, draws attention when present                                   |
| **Comments**          | Grey             | `#53685B`      | De-emphasized but readable                                           |
| **Operators**         | Dark Green       | `#459451`      | Present but unobtrusive                                              |
| **Errors**            | Red              | `#FF5345`      | High contrast for visibility                                         |

---

## Files to Modify

### Primary File

**`/Users/stevedimakos/Projects/Personal/osaka-jade.nvim/colors/osaka-jade.lua`**

This is the main colorscheme file containing:

- Palette definitions (lines ~39-74)
- Syntax highlights (lines ~179-222)
- TreeSitter highlights (lines ~226-339)

### Secondary File (May Need Updates)

**`/Users/stevedimakos/Projects/Personal/osaka-jade.nvim/lua/lualine/themes/osaka-jade.lua`**

If color palette variable names change, this file needs updating.

---

## Phase 1: Update Color Palette Variables

**Status:** 🔲 Not Started

### Current Palette (Problematic)

```lua
-- Current: Colors named by ANSI position, not semantic role
local c = {
  blue = "#509475",    -- Actually jade-tinted, used for keywords AND functions
  green = "#549e6a",   -- Used for strings AND operators
  cyan = "#2DD5B7",    -- Underutilized primary accent
  -- ...
}
```

### Updated Palette (Semantic Names)

```lua
-- Palette with semantic aliases for clarity
local c = {
  -- Primary colors (from omarchy)
  bg = "#111c18",
  fg = "#C1C497",
  cursor = "#D7C995",

  -- ANSI colors (keep for terminal compatibility)
  black = "#23372B",
  red = "#FF5345",
  green = "#549e6a",     -- muted_jade
  yellow = "#459451",    -- forest_green (omarchy color3)
  blue = "#509475",      -- jade_teal (omarchy color4)
  magenta = "#D2689C",   -- pink
  cyan = "#2DD5B7",      -- bright_mint (PRIMARY ACCENT)
  white = "#F6F5DD",

  -- Bright colors
  bright_black = "#53685B",  -- comment
  bright_red = "#db9f9c",
  bright_green = "#63b07a",  -- bright_jade
  bright_yellow = "#E5C736", -- actual_yellow
  bright_blue = "#ACD4CF",
  bright_magenta = "#75bbb3",
  bright_cyan = "#8CD3CB",
  bright_white = "#9eebb3",

  -- Derived backgrounds
  bg1 = "#1a2520",
  bg2 = "#23372B",
  bg3 = "#2a3530",

  none = "NONE",
}

-- ============================================
-- SYNTAX-SPECIFIC SEMANTIC ALIASES
-- The palette already has `comment`, `selection`, `none` aliases.
-- These add syntax highlighting aliases for consistent color usage.
-- ============================================
c.keyword = c.cyan           -- #2DD5B7 - bright mint
c.string = c.bright_green    -- #63b07a - bright jade
c.func = c.blue              -- #509475 - jade teal
c.type = c.green             -- #549e6a - muted jade
c.variable = c.fg            -- #C1C497 - cream
c.number = c.magenta         -- #D2689C - pink
c.comment = c.bright_black   -- #53685B - grey
c.operator = c.yellow        -- #459451 - forest green
c.error = c.red              -- #FF5345 - red (errors only)
c.builtin = c.cyan           -- #2DD5B7 - self/this use accent, NOT red
```

### Tasks

- [ ] Add syntax-specific semantic aliases after existing palette aliases
- [ ] Verify ANSI colors remain unchanged for terminal compatibility
- [ ] Document the mapping in code comments

---

## Phase 2: Update Legacy Vim Syntax Groups

**Status:** 🔲 Not Started

### Current Mappings (Lines 179-222)

```lua
-- Current: Too similar colors
hi("Keyword", { fg = c.blue })      -- #509475
hi("Function", { fg = c.blue })     -- #509475  (SAME!)
hi("String", { fg = c.green })      -- #549e6a
hi("Operator", { fg = c.green })    -- #549e6a  (SAME!)
```

### Updated Mappings

```lua
-- =============================================================================
-- Syntax Highlights (Updated with hierarchical pattern)
-- =============================================================================

-- Comments
hi("Comment", { fg = c.comment, italic = true })

-- Constants
hi("Constant", { fg = c.number })          -- Pink for constants
hi("String", { fg = c.string })            -- #63b07a - Bright green
hi("Character", { fg = c.string })
hi("Number", { fg = c.number })            -- #D2689C - Pink
hi("Boolean", { fg = c.number })           -- Pink for true/false
hi("Float", { fg = c.number })

-- Identifiers
hi("Identifier", { fg = c.variable })      -- #C1C497 - Cream
hi("Function", { fg = c.func })            -- #509475 - Jade teal

-- Statements
hi("Statement", { fg = c.keyword })        -- #2DD5B7 - Bright mint
hi("Conditional", { fg = c.keyword })      -- if, else, switch
hi("Repeat", { fg = c.keyword })           -- for, while
hi("Label", { fg = c.keyword })
hi("Operator", { fg = c.operator })        -- #459451 - Forest green
hi("Keyword", { fg = c.keyword })          -- #2DD5B7 - Bright mint
hi("Exception", { fg = c.error })          -- try, catch, throw

-- Preprocessor
hi("PreProc", { fg = c.keyword })
hi("Include", { fg = c.keyword })          -- import, require
hi("Define", { fg = c.keyword })
hi("Macro", { fg = c.func })               -- Macro calls like functions
hi("PreCondit", { fg = c.keyword })

-- Types
hi("Type", { fg = c.type })                -- #549e6a - Muted jade
hi("StorageClass", { fg = c.keyword })     -- const, let, var
hi("Structure", { fg = c.type })           -- class, struct
hi("Typedef", { fg = c.type })

-- Special
hi("Special", { fg = c.bright_cyan })      -- #8CD3CB
hi("SpecialChar", { fg = c.string })       -- Escape sequences
hi("Tag", { fg = c.keyword })              -- HTML/XML tags
hi("Delimiter", { fg = c.fg })             -- Punctuation
hi("SpecialComment", { fg = c.comment })
hi("Debug", { fg = c.error })

-- Underlined, Bold, Italic
hi("Underlined", { underline = true })
hi("Bold", { bold = true })
hi("Italic", { italic = true })
hi("Ignore", { fg = c.bg })
hi("Error", { fg = c.error })
hi("Todo", { fg = c.bright_yellow, bg = c.bg1, bold = true })
```

### Tasks

- [ ] Update all legacy syntax groups to use semantic aliases
- [ ] Ensure each category has a distinct color
- [ ] Test with `:highlight` command to verify

---

## Phase 3: Update TreeSitter Highlight Groups

**Status:** 🔲 Not Started

TreeSitter provides fine-grained syntax highlighting. These groups override legacy groups when TreeSitter is active.

### Updated TreeSitter Mappings

```lua
-- =============================================================================
-- Treesitter Highlights (Lines ~226-339)
-- =============================================================================

-- Variables
hi("@variable", { fg = c.variable })           -- #C1C497 - cream
hi("@variable.builtin", { fg = c.builtin })    -- self, this -> cyan/mint (NOT red - red = errors only)
hi("@variable.parameter", { fg = c.bright_white })
hi("@variable.member", { fg = c.type })        -- object.property

-- Constants
hi("@constant", { fg = c.number })             -- #D2689C - pink
hi("@constant.builtin", { fg = c.number })     -- true, false, nil
hi("@constant.macro", { fg = c.number })

-- Modules
hi("@module", { fg = c.type })
hi("@label", { fg = c.keyword })

-- Strings
hi("@string", { fg = c.string })               -- #63b07a - bright green
hi("@string.escape", { fg = c.keyword })       -- \n, \t -> cyan
hi("@string.special", { fg = c.keyword })
hi("@string.regexp", { fg = c.bright_cyan })

-- Characters
hi("@character", { fg = c.string })
hi("@character.special", { fg = c.keyword })

-- Numbers
hi("@boolean", { fg = c.number })              -- #D2689C - pink
hi("@number", { fg = c.number })
hi("@number.float", { fg = c.number })

-- Types
hi("@type", { fg = c.type })                   -- #549e6a - muted jade
hi("@type.builtin", { fg = c.type })           -- int, string, bool
hi("@type.definition", { fg = c.type })

-- Attributes & Properties
hi("@attribute", { fg = c.keyword })           -- Decorators
hi("@property", { fg = c.type })               -- Object properties

-- Functions
hi("@function", { fg = c.func })               -- #509475 - jade teal
hi("@function.builtin", { fg = c.func })       -- print, len
hi("@function.call", { fg = c.func })
hi("@function.macro", { fg = c.func })
hi("@function.method", { fg = c.func })
hi("@function.method.call", { fg = c.func })

-- Constructors & Operators
hi("@constructor", { fg = c.type })            -- new ClassName()
hi("@operator", { fg = c.operator })           -- #459451 - forest green

-- Keywords (THE STAR - brightest color)
hi("@keyword", { fg = c.keyword })             -- #2DD5B7 - BRIGHT MINT
hi("@keyword.coroutine", { fg = c.keyword })
hi("@keyword.function", { fg = c.keyword })    -- function, def, fn
hi("@keyword.operator", { fg = c.keyword })    -- and, or, not
hi("@keyword.import", { fg = c.keyword })      -- import, from, require
hi("@keyword.storage", { fg = c.keyword })     -- const, let, var
hi("@keyword.repeat", { fg = c.keyword })      -- for, while, loop
hi("@keyword.return", { fg = c.keyword })      -- return
hi("@keyword.debug", { fg = c.error })
hi("@keyword.exception", { fg = c.error })     -- try, catch, throw
hi("@keyword.conditional", { fg = c.keyword }) -- if, else, switch
hi("@keyword.directive", { fg = c.keyword })   -- #pragma, @decorator
hi("@keyword.directive.define", { fg = c.keyword })

-- Punctuation
hi("@punctuation.delimiter", { fg = c.fg })    -- ; , .
hi("@punctuation.bracket", { fg = c.fg })      -- () [] {}
hi("@punctuation.special", { fg = c.operator })

-- Comments
hi("@comment", { fg = c.comment, italic = true })
hi("@comment.documentation", { fg = c.comment })
hi("@comment.error", { fg = c.error })
hi("@comment.warning", { fg = c.bright_yellow })
hi("@comment.todo", { fg = c.bright_yellow, bold = true })
hi("@comment.note", { fg = c.keyword })

-- Markup (markdown, etc.)
hi("@markup.strong", { bold = true })
hi("@markup.italic", { italic = true })
hi("@markup.strikethrough", { strikethrough = true })
hi("@markup.underline", { underline = true })
hi("@markup.heading", { fg = c.keyword, bold = true })
hi("@markup.quote", { fg = c.comment, italic = true })
hi("@markup.math", { fg = c.keyword })
hi("@markup.link", { fg = c.keyword, underline = true })
hi("@markup.link.label", { fg = c.string })
hi("@markup.link.url", { fg = c.keyword, underline = true })
hi("@markup.raw", { fg = c.string })
hi("@markup.raw.block", { fg = c.fg })
hi("@markup.raw.markdown_inline", { fg = c.string, bg = c.bg1 })
hi("@markup.list", { fg = c.keyword })
hi("@markup.list.checked", { fg = c.keyword })
hi("@markup.list.unchecked", { fg = c.comment })

-- Diff
hi("@diff.plus", { fg = c.string })
hi("@diff.minus", { fg = c.error })
hi("@diff.delta", { fg = c.type })

-- Tags (HTML/JSX)
hi("@tag", { fg = c.keyword })                 -- <div>
hi("@tag.attribute", { fg = c.type })          -- class=
hi("@tag.delimiter", { fg = c.fg })            -- < > />

-- =============================================================================
-- LSP Semantic Tokens (override TreeSitter when LSP provides richer info)
-- Without these, LSP semantic highlighting may ignore your TreeSitter colors
-- =============================================================================
hi("@lsp.type.class", { fg = c.type })
hi("@lsp.type.decorator", { fg = c.keyword })
hi("@lsp.type.enum", { fg = c.type })
hi("@lsp.type.enumMember", { fg = c.number })
hi("@lsp.type.function", { fg = c.func })
hi("@lsp.type.interface", { fg = c.type })
hi("@lsp.type.macro", { fg = c.func })
hi("@lsp.type.method", { fg = c.func })
hi("@lsp.type.namespace", { fg = c.type })
hi("@lsp.type.parameter", { fg = c.bright_white })
hi("@lsp.type.property", { fg = c.type })
hi("@lsp.type.struct", { fg = c.type })
hi("@lsp.type.type", { fg = c.type })
hi("@lsp.type.typeParameter", { fg = c.type })
hi("@lsp.type.variable", { fg = c.variable })

-- =============================================================================
-- Neovim 0.9 Compatibility (optional - @text.* was renamed to @markup.* in 0.10)
-- Uncomment these if you need to support Neovim 0.9 users
-- =============================================================================
-- hi("@text.strong", { link = "@markup.strong" })
-- hi("@text.emphasis", { link = "@markup.italic" })
-- hi("@text.underline", { link = "@markup.underline" })
-- hi("@text.strike", { link = "@markup.strikethrough" })
-- hi("@text.title", { link = "@markup.heading" })
-- hi("@text.quote", { link = "@markup.quote" })
-- hi("@text.uri", { link = "@markup.link.url" })
-- hi("@text.math", { link = "@markup.math" })
-- hi("@text.reference", { link = "@markup.link" })
-- hi("@text.literal", { link = "@markup.raw" })
-- hi("@text.todo", { link = "@comment.todo" })
```

### Tasks

- [ ] Update all @-prefixed TreeSitter groups
- [ ] Keywords use `c.keyword` (bright mint #2DD5B7)
- [ ] Functions use `c.func` (jade teal #509475)
- [ ] Strings use `c.string` (bright green #63b07a)
- [ ] Types use `c.type` (muted jade #549e6a)
- [ ] `@variable.builtin` uses `c.builtin` (cyan, NOT red)
- [ ] Add LSP semantic token mappings (`@lsp.type.*`)
- [ ] Test with various file types
- [ ] (Optional) Add Neovim 0.9 `@text.*` fallbacks if needed

---

## Phase 4: Update Plugin Highlight Groups

**Status:** 🔲 Not Started

Several plugin highlights reference the palette colors. Update any that still use the old color assignments.

### Groups to Review

| Section     | Line Range | Status |
| ----------- | ---------- | ------ |
| Telescope   | ~465-481   | Review |
| Neo-tree    | ~484-503   | Review |
| Blink.cmp   | ~639-686   | Review |
| Snacks.nvim | ~689-730   | Review |
| Navic       | ~607-635   | Review |

Most plugin highlights should be fine since they use `c.green`, `c.cyan`, etc. which remain unchanged. However, verify that semantic intent matches the new pattern.

### Tasks

- [ ] Audit plugin highlight groups for consistency
- [ ] Ensure completion kinds use appropriate colors
- [ ] Verify Telescope matching uses accent color

---

## Phase 5: Update Lualine Theme

**Status:** 🔲 Not Started

**File:** `/Users/stevedimakos/Projects/Personal/osaka-jade.nvim/lua/lualine/themes/osaka-jade.lua`

### Current Lualine Theme

```lua
-- Current: Uses c.blue for normal mode
return {
  normal = {
    a = { fg = colors.bg, bg = colors.blue, gui = "bold" },  -- #509475
```

### Updated Lualine Theme

```lua
-- Updated: Use cyan (bright mint) for normal mode
return {
  normal = {
    a = { fg = colors.bg, bg = colors.cyan, gui = "bold" },  -- #2DD5B7
    b = { fg = colors.fg, bg = colors.bg2 },
    c = { fg = colors.fg, bg = colors.bg1 },
  },
  insert = {
    a = { fg = colors.bg, bg = colors.green, gui = "bold" },  -- #549e6a
  },
  visual = {
    a = { fg = colors.bg, bg = colors.magenta, gui = "bold" },  -- #D2689C
  },
  replace = {
    a = { fg = colors.bg, bg = colors.red, gui = "bold" },  -- #FF5345
  },
  command = {
    a = { fg = colors.bg, bg = colors.bright_yellow, gui = "bold" },  -- #E5C736
  },
  inactive = {
    a = { fg = colors.bright_black, bg = colors.bg1, gui = "bold" },
    b = { fg = colors.bright_black, bg = colors.bg1 },
    c = { fg = colors.bright_black, bg = colors.bg1 },
  },
}
```

### Tasks

- [ ] Update normal mode to use `cyan` (#2DD5B7)
- [ ] Verify other modes have appropriate colors
- [ ] Test lualine appearance in Neovim

---

## Testing Checklist

### Visual Verification

After implementation, open files in these languages and verify differentiation:

| Language              | Test File               | What to Check                                |
| --------------------- | ----------------------- | -------------------------------------------- |
| JavaScript/TypeScript | Any `.ts` file          | Keywords cyan, functions teal, strings green |
| Python                | Any `.py` file          | `def` cyan, function names teal              |
| Lua                   | `colors/osaka-jade.lua` | `local`, `function`, `if` all cyan           |
| Markdown              | `README.md`             | Links cyan, code blocks green                |
| JSON                  | `package.json`          | Keys vs values distinguishable               |

### Commands to Run

```vim
" Check highlight group under cursor
:Inspect

" Show all highlight groups
:highlight

" Test colorscheme reload
:colorscheme osaka-jade

" Check if TreeSitter is active
:TSHighlightCapturesUnderCursor
```

### Comparison Test

Open a TypeScript file side-by-side with Tokyo Night and osaka-jade to verify similar visual hierarchy.

---

## Success Criteria

| Criterion                | Measurement        | Target                             |
| ------------------------ | ------------------ | ---------------------------------- |
| Keywords distinguishable | Visual check       | Bright mint (#2DD5B7) stands out   |
| Functions vs Keywords    | Visual check       | Different shades, clear hierarchy  |
| Strings visible          | Visual check       | Bright green (#63b07a) is distinct |
| No "jade soup"           | Overall impression | At least 5 distinct colors visible |
| Terminal colors work     | `:terminal` test   | ANSI colors correct                |
| Lualine themed           | Status bar check   | Cyan normal mode                   |

---

## Implementation Order

1. **Phase 1:** Palette semantic aliases (5 min)
2. **Phase 2:** Legacy Vim syntax groups (10 min)
3. **Phase 3:** TreeSitter groups + LSP semantic tokens (20 min)
4. **Phase 4:** Plugin highlight audit (10 min)
5. **Phase 5:** Lualine theme (5 min)
6. **Testing:** All language files + `:Inspect` verification (15 min)

**Total estimated time:** ~65 minutes

---

## Important Notes

### LSP Semantic Tokens vs TreeSitter

Neovim has **two highlighting systems** that can conflict:

1. **TreeSitter** (`@function`, `@keyword`, etc.) - Parser-based, always available
2. **LSP Semantic Tokens** (`@lsp.type.function`, etc.) - Language server-based, takes precedence

If you only define TreeSitter groups, LSP-enabled buffers may look different because the LSP semantic tokens override them. The plan includes `@lsp.type.*` mappings to ensure consistent colors.

**To debug highlighting issues:**

```vim
:Inspect    " Shows which highlight group applies under cursor
```

### Neovim Version Compatibility

| Version | TreeSitter Groups | Notes                          |
| ------- | ----------------- | ------------------------------ |
| 0.10+   | `@markup.*`       | Current standard               |
| 0.9.x   | `@text.*`         | Old names, need fallback links |

The plan includes commented-out `@text.*` fallbacks. Uncomment if supporting Neovim 0.9.

---

## Appendix: Color Visualization

```
BEFORE (jade soup):
┌──────────────────────────────────────────────┐
│ function doSomething(param) {                │
│ ████████ ███████████ █████  █                │  <- All same green
│                                              │
│   if (param === "test") {                    │
│   ██ █████ ███ ██████  █                     │  <- Keywords blend in
│                                              │
│     return true;                             │
│     ██████ ████                              │  <- Can't distinguish
│   }                                          │
│ }                                            │
└──────────────────────────────────────────────┘

AFTER (Tokyo Night pattern):
┌──────────────────────────────────────────────┐
│ function doSomething(param) {                │
│ ████████ ███████████ █████  █                │
│ cyan     teal        cream  fg               │  <- Distinct!
│                                              │
│   if (param === "test") {                    │
│   ██ █████ ███ ██████  █                     │
│   cyan     forest bright-green               │  <- Clear hierarchy
│                                              │
│     return true;                             │
│     ██████ ████                              │
│     cyan   pink                              │  <- Boolean pops
│   }                                          │
│ }                                            │
└──────────────────────────────────────────────┘

Legend:
  cyan (#2DD5B7)       = keywords: function, if, return
  teal (#509475)       = function names
  bright-green (#63b07a) = strings
  pink (#D2689C)       = booleans, numbers
  forest (#459451)     = operators
  cream (#C1C497)      = variables, parameters
  grey (#53685B)       = comments
```

---

## References

- [Tokyo Night nvim](https://github.com/folke/tokyonight.nvim) - Pattern source
- [Catppuccin nvim](https://github.com/catppuccin/nvim) - Plugin highlight reference
- [Omarchy Osaka Jade](https://github.com/basecamp/omarchy/tree/master/themes/osaka-jade) - Original palette
- [Neovim Treesitter Highlights](https://neovim.io/doc/user/treesitter.html#treesitter-highlight) - Group reference
