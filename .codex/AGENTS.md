# Steez AI Assistant Preferences
<!-- Canonical source: this file is symlinked to the following, so edits here update all:
  - ~/.codex/AGENTS.md
  - ~/.gemini/GEMINI.md
  - ~/.claude/CLAUDE.md
  - ~/.config/opencode/AGENTS.md
  - GEMINI.md (repo symlink)
  - .claude/CLAUDE.md (repo symlink)
  - .gemini/GEMINI.md (repo symlink)
  - .config/opencode/AGENTS.md (repo symlink)
-->

## Critical Rules
1. Always check official docs first. Cite sources.
2. **NEVER EVER** add AI branding, signatures, or "Generated with AI" to commits. NO exceptions.
   - DO NOT add "🤖 Generated with [Claude Code](https://claude.com/claude-code)"
   - DO NOT add "Co-Authored-By: Claude <noreply@anthropic.com>"
   - DO NOT add ANY AI-related footers, signatures, or metadata to commits
3. Present plan ONLY for implementation requests. Answer exploratory questions ("what can we do?", "what are my options?") directly without formal plans.
4. Explain root cause ONLY when debugging actual bugs/errors. Skip for feature requests or exploratory questions.
5. Favor correct, durable fixes over minimal diffs. Choose the smallest change that fully addresses the problem and supports long-term maintainability; if the proper fix is a larger refactor, state the scope and proceed after confirmation.
6. **IF AND ONLY IF** the `write_todos` tool is available, you **MUST** use it for any task requiring a **Plan** (Implementation requests), complex debugging sessions, or multiple steps.

## Communication
- Direct and concise
- Bullet points over paragraphs
- Clear "What changed and why" for code edits
- Match my straightforward tone
- Root cause analysis: Use for debugging/fixing issues, not for adding features

## Code Editing Rules
- Choose the smallest change that fully fixes the issue and is maintainable; if the proper fix requires a larger refactor, outline the scope and get confirmation first.
- Show diff-style or isolated snippets, not full rewrites.
- Do not restructure, rename, or abstract unless explicitly approved.
- If uncertain, ask before modifying.
- Always run project-specific formatters (Prettier, StyLua, ESLint) on modified files before finalizing.

## Terminal/CLI Tool Expectations
- When creating/editing files, show explicit file paths before and after changes.
- For multi-file changes, present a checklist of affected files first and wait for approval.
- Use bash commands when appropriate for file operations (search, move, list).
- If code can be tested/validated locally, do so before suggesting.

## Keybind Management
- **CRITICAL:** When modifying ANY keybindings in the dotfiles, ALWAYS update the Raycast keybind extension at `~/Projects/Personal/dotfiles/raycast/extensions/keybinds/src/search-keybinds.tsx`
- This applies to changes in: Neovim config, Aerospace config, or any other application keybinds
- Keep the Raycast extension in sync so keybinds can be easily searched and referenced

## Workflow
- Distinguish request type:
  - Exploratory ("what can we do?", "how does X work?") → Answer directly with options/explanation
  - Implementation ("add X", "modify Y", "fix Z") → Present plan with phases, get approval
- Break tasks into phases, pause for approval between phases
- **Assumptions:** State them clearly when proceeding
  - Safe to assume: code style, naming, standard libs, project structure
  - Always ask: architecture, data structures, API integrations, business logic, security
- If assumptions would risk incorrect results, ask one focused clarification question

## Technical Context
- Role: CTO / Director of IT
- Core: NetSuite (SuiteScript 2.x, workflows, saved searches)
- Stack: JavaScript/SuiteScript, Bash, Go, Lua, Python
- Env: macOS, clean Git history
- Git: Use [Conventional Commits](https://www.conventionalcommits.org/) (feat:, fix:, chore:)
- CAPS key mapping: CAPS = CTRL + ALT + CMD (via Karabiner Elements)
- DOTFILES path: $HOME/Projects/Personal/dotfiles

## NetSuite Guidelines
- SuiteScript 2.x default (not 1.0); prefer 2.1 modules unless 1.0 is explicitly required
- Cite SuiteAnswers when available
- Consider governance limits always
- Prefer `try/catch` blocks around governance-heavy operations. Fail fast to preserve resources.
- Flag deprecated methods
- Map/Reduce: keep `getInputData` lightweight; heavy logic in map/reduce stages; use summarize only when needed
- Logging: keep logs structured and concise; strip sensitive data
- **Script Headers:** ALWAYS include standard JSDoc headers in new files (`@NApiVersion 2.1`, `@NScriptType [Type]`)
- **Naming:** Use standard prefixes (`UE_` User Event, `CS_` Client, `MR_` Map/Reduce, `SL_` Suitelet, `SS_` Scheduled)
- **Imports:** Use relative paths for custom modules (`./Lib/...`) and standard syntax (`N/record`)

## SuiteCloud CLI
- **Preference:** Prefer `suitecloud` CLI commands (e.g., `suitecloud project:deploy`, `suitecloud file:upload`) over manual UI uploads
- **Validation:** Prioritize `project:deploy --validate` to catch issues early

## JavaScript/SuiteScript Standards
- Use modern JavaScript (ES6+)

## Avoid
- Adding AI comments or Generated with AI to GitHub commits
- Undocumented solutions
- Over-engineering
- Silent structural changes
- Explanations without action steps
- Governance limit violations
- SuiteScript 1.0 patterns in 2.x code
