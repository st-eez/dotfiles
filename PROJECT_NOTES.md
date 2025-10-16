# Project Notes: Dotfiles Installer

## Overview
Tracking progress and decisions while building an automated installer for the dotfiles repo.

## Key Decisions & Scope
- Manage and back up: `zsh/.zshrc`, `zsh/.zprofile`, `zsh/.p10k.zsh`, `zsh/.oh-my-zsh/custom/aliases.zsh`, `ghostty/config`, and the entire `nvim/` directory.
- Use the repo `Brewfile` for Homebrew taps/formulae/casks/VS Code extensions.
- Automate prerequisites: Xcode Command Line Tools, Homebrew (plus `brew shellenv`), Oh My Zsh with powerlevel10k, zsh-autosuggestions, and zsh-syntax-highlighting.
- LazyVim bootstraps itself via `lua/config/lazy.lua` (auto-clones lazy.nvim); Oh My Zsh requires scripted install plus plugin clones.
- Leave fonts, macOS `defaults`, `/etc/hosts` tweaks, and secrets/per-machine overrides as manual or future enhancements.
- References to revisit:
  - https://github.com/atomantic/dotfiles?tab=readme-ov-file#restoring-dotfiles
  - https://dotfiles.github.io/

## Plan
1. Confirm repo inventory & decide which files to manage via script. ✅
2. Scaffold installer script with helper functions and structure. ✅
3. Preflight + base installs (CLT, Homebrew, oh-my-zsh + plugins/theme, essential brew installs for Ghostty/Neovim stack). ✅
4. Back up existing dotfiles (timestamped folders like `~/.dotfiles_backup/YYYY.MM.DD.HH.MM.SS`). ✅
5. Symlink tracked configs (Zsh, Ghostty, Neovim) into target home. ✅
6. Terminal configuration & menu foundation (macOS tweaks deferred to future version). ✅
7. Verification summary and future hooks (add end-of-run report + optional tests).
8. (Optional future) Restore routine for `.dotfiles_backup/<timestamp>` folders.

## Session Log
- _Step 1 complete_: Reviewed repo contents and `mac_setup.md`; confirmed LazyVim self-installs while Oh My Zsh needs explicit setup.
- _Step 2 complete_: Created `scripts/install.sh` scaffold with logging helpers, argument parsing, dry-run support, and path overrides for sandbox testing.
- _Step 3 complete_: Added preflight logic for Xcode CLT, Homebrew installation + shellenv, Oh My Zsh (and plugins), and essential brew installs (neovim, fzf, ripgrep, ghostty); dry-run still supports sandboxing.
- _Step 4 complete_: Added timestamped backup routine mirroring atomantic (~/.dotfiles_backup/<timestamp>) for Zsh, Ghostty, and Neovim files prior to linking.
- _Step 5 complete_: Symlink routine now links zsh, ghostty, and nvim paths back to the repo, handling dry-run removal/logging.
- _Step 6 complete_: Added interactive menu (arrow-key TUI with “Cancel / Exit”), banner restyle, polished wrap-up copy, and Ghostty launch prompt.
- _Step 6 note_: Non-terminal tweaks (Raycast, Rectangle, JankyBorders, AutoRaise, etc.) are postponed to a later version.
- _Step 7 todo_: Implement post-run verification summary (show backup folder, symlink targets), optionally add automated checks/tests before exit.
- Extras added: interactive confirmation (skip with `-y/--yes`), `--verbose` flag, green “steez” ASCII banner on start, post-run quickstart summary + Ghostty launch prompt (skips in dry-run).
- Repo status: changes committed as `Add Ghosteez installer with interactive menu` on `main` and pushed to GitHub.
- Extras added: interactive confirmation (skip with `-y/--yes`), `--verbose` flag, post-run quickstart summary + Ghostty launch prompt (skips in dry-run).
- _Naming_: Banner/menu now introduce the tool as “Steez macOS util” to reflect upcoming multi-app automation work.
- _Finish prompt polish_: Conversational wrap-up now nudges Ghostty launch (say yes to the prompt or run `open -a Ghostty`) before `exec zsh`, then P10K and LazyVim steps so the order is crystal clear post-install.

## Future Ideas
- Add interactive menus for optional brew bundles (Raycast, Rectangle, JankyBorders, AutoRaise, etc.).
- Script a restore helper to move files back from `.dotfiles_backup/<timestamp>/`.
- Expand validation/summary reporting after install.
- Potential refinements:
  - Double-check `.config` and nested directories before linking (even in dry-run).
  - Harden `ensure_git_clone` with explicit success checks.
  - Support richer end-of-run summaries.
  - Improve handling for pre-existing symlinks pointing outside the repo.

## Next Session Starting Points
- Implement Step 7 verification summary (print backup path, symlink map, maybe prompt to run smoke checks).
- Consider a restore helper stub and decide how menu will grow for future profiles (VS Code, Chromium theme).
- Revisit verbose logging (`verb` helper currently unused).
