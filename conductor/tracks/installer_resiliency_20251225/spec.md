# Spec: Cross-Platform Installer Resiliency & Linux Compatibility

## Overview
This track addresses several critical gaps in the `install.sh` framework to ensure it "just works" on fresh installations of Omarchy (Arch), Ubuntu/Mint, and macOS. It focuses on dependency management, installation ordering, shell configuration stability, and environment-agnostic configuration.

## Functional Requirements

### 1. Zsh Environment Robustness (All OS)
- **Auto-Installation:** If Zsh is selected but Oh-My-Zsh (OMZ) or required plugins (`zsh-autosuggestions`, `zsh-syntax-highlighting`) are missing, the installer will automatically install them.
- **P10k Theme:** Ensure `powerlevel10k` is cloned to the correct custom theme directory so the new `.zshrc` loads it successfully, replacing any default distro prompt (like Starship).
- **Guard Rails:** The `.zshrc` template will be updated with guards (e.g., `command -v zoxide >/dev/null`) to prevent errors if tools are missing.
- **Path Cleanup:** Ensure `~/.oh-my-zsh/custom/aliases.zsh` is created safely and doesn't break if OMZ isn't yet active.

### 2. Dependency & Order Management
- **Installation Order:** Reorder `TERMINAL_PKGS` in `config.sh` to ensure base runtimes (Node.js, Python) are installed before their respective global packages (Codex, Gemini).
- **Self-Healing Dependencies:** In `install_package`, if an `npm` or `pip` package is requested but the runtime is missing, the script will attempt to install the runtime first.
- **AUR Helper (Arch/Omarchy):** If an AUR package is requested but no helper (`yay`/`paru`) is found, the script will automatically bootstrap `yay`.

### 3. Visual & Configuration Parity
- **Font Support:**
    - **Arch:** Map `ttf-jetbrains-mono-nerd` via `yay`.
    - **macOS:** Map `font-jetbrains-mono-nerd-font` via `brew`.
    - **Ubuntu/Debian:** Implement a script function to download the latest release tarball from GitHub, extract to `~/.local/share/fonts`, and run `fc-cache -f`.
- **Git Config Portability:**
    - Convert `git/.gitconfig.template` to use placeholders (e.g., `{{GH_PATH}}`, `{{HOME_DIR}}`).
    - Add a setup step that reads the template, resolves the actual path to `gh` (using `which gh`), replaces placeholders, and writes the final `~/.gitconfig`.

## Non-Functional Requirements
- **Idempotency:** Re-running the script should not duplicate OMZ installations, plugin clones, or font downloads (if already present).
- **Silent Failure Prevention:** Ensure every package manager call is wrapped in a way that provides clear feedback if a dependency is missing.

## Acceptance Criteria
- [ ] `install.sh` successfully installs `codex` on a clean machine where `node` was not previously present.
- [ ] Running the script on Omarchy results in a working Zsh shell with P10k theme and plugins active (replacing default Starship).
- [ ] Ghostty displays icons correctly due to the presence of the Nerd Font (verified by `fc-list`).
- [ ] `~/.gitconfig` is generated with valid absolute paths for the credential helper on both macOS and Linux.
- [ ] `yay` is automatically installed on Arch if missing.

## Out of Scope
- Migrating the entire configuration to a different tool (like Ansible).
- Handling non-standard package managers (like Nix or Snap).
