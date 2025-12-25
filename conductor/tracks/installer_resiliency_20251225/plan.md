# Plan: Cross-Platform Installer Resiliency & Linux Compatibility

## Phase 1: Foundation & Dependency Management [checkpoint: d36b54c]
- [x] Task: Reorder `TERMINAL_PKGS` in `installer/config.sh` to place `node` and `python` at the top.
- [x] Task: Update `installer/install.sh` -> `install_package` to check for runtime availability (node/npm/pip) before attempting global package installs.
- [x] Task: Implement `bootstrap_aur_helper` in `installer/install.sh` to auto-install `yay` if missing on Arch-based systems.
- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Zsh & Theme Robustness [checkpoint: 545c2b7]
- [x] Task: Create `installer/zsh_setup.sh` (or update `installer/install.sh`) to:
    - Clone Oh-My-Zsh if `~/.oh-my-zsh` is missing.
    - Clone `zsh-autosuggestions` and `zsh-syntax-highlighting` to `$ZSH_CUSTOM/plugins`.
    - Clone `powerlevel10k` to `$ZSH_CUSTOM/themes/powerlevel10k`.
- [x] Task: Update `zsh/.zshrc` template with guards for `zoxide`, `thefuck`, and other CLI tool initializations.
- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Visual & Configuration Parity [checkpoint: cce3fb8]
- [x] Task: Implement `install_nerd_fonts` in `installer/install.sh`:
    - Arch: `yay -S ttf-jetbrains-mono-nerd`
    - macOS: `brew install --cask font-jetbrains-mono-nerd-font`
    - Ubuntu/Debian: Manual download from GitHub releases to `~/.local/share/fonts`.
- [x] Task: Create `installer/git_setup.sh`:
    - Read `git/.gitconfig.template`.
    - Detect `gh` path via `which gh`.
    - Replace `{{GH_PATH}}` and `{{HOME_DIR}}` placeholders.
    - Write result to `~/.gitconfig`.
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: Integration & Verification
- [x] Task: Update main `install.sh` to call the new Zsh and Git setup steps during the installation flow.
- [x] Task: Add a conflict check for `~/.zshrc` that offers to backup before `stow` runs.
- [x] Task: Verify the full flow on a clean (simulated or real) Arch/Omarchy environment.
- [x] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)
