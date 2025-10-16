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
6. Terminal configuration & menu foundation (macOS tweaks deferred to future version).
7. Verification summary and future hooks.
8. (Optional future) Restore routine for `.dotfiles_backup/<timestamp>` folders.

## Session Log
- _Step 1 complete_: Reviewed repo contents and `mac_setup.md`; confirmed LazyVim self-installs while Oh My Zsh needs explicit setup.
- _Step 2 complete_: Created `scripts/install.sh` scaffold with logging helpers, argument parsing, dry-run support, and path overrides for sandbox testing.
- _Step 3 complete_: Added preflight logic for Xcode CLT, Homebrew installation + shellenv, Oh My Zsh (and plugins), and essential brew installs (neovim, fzf, ripgrep, ghostty); dry-run still supports sandboxing.
- _Step 4 complete_: Added timestamped backup routine mirroring atomantic (~/.dotfiles_backup/<timestamp>) for Zsh, Ghostty, and Neovim files prior to linking.
- _Step 5 complete_: Symlink routine now links zsh, ghostty, and nvim paths back to the repo, handling dry-run removal/logging.
- _Step 6 note_: Decided to leave Raycast/Rectangle/JankyBorders/AutoRaise and other tweaks for a future version; current script focuses purely on terminal stack.
- Added features: interactive confirmation (skip with `-y/--yes`), `--verbose` flag, and green “steez” ASCII banner on start.
- Menu upgraded: arrow-key TUI replaces numbered prompt (highlights selection, includes explicit “Cancel / Exit”, and falls back to default selection when non-interactive).
- Post-run prompt: after Ghostty profile completes, installer replays the banner, shows a quickstart summary (important files, aliases), and offers to launch Ghostty (skips in dry-run or when app missing).

## Future Ideas
- Add interactive menus for optional brew bundles (Raycast, Rectangle, JankyBorders, AutoRaise, etc.).
- Script a restore helper to move files back from `.dotfiles_backup/<timestamp>/`.
- Expand validation/summary reporting after install.
- Potential refinements:
  - Double-check `.config` and nested directories before linking (even in dry-run).
  - Harden `ensure_git_clone` with explicit success checks.
  - Support richer end-of-run summaries.
  - Improve handling for pre-existing symlinks pointing outside the repo.
