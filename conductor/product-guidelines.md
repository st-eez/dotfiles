# Product Guidelines - Steez Dotfiles

## UI & Aesthetics
- **Cohesive Tokyo Night Theme**: All CLI interactions must strictly adhere to the Tokyo Night color palette using hex codes (e.g., `#7aa2f7` for primary, `#bb9af7` for secondary, `#f7768e` for errors).
- **Dynamic Feedback**: Use `gum` spinners and progress bars to provide real-time updates without cluttering the terminal buffer. The UI should feel "alive" but remain clean.
- **Iconography**: Use consistent Nerd Font icons (e.g., `✔`, `✘`, `❯`, `󰘧`) for status indicators.

## Reliability & Safety
- **Hybrid Error Handling**:
    - **Fail Fast**: The installer must stop immediately if core dependencies (Homebrew, Git, Stow, Gum) fail to load or install.
    - **Skip & Report**: For individual user packages, the installer should log failures, continue the process, and provide a clear summary at the end.
- **Automated Backups**: Never overwrite an existing configuration file without a backup. Move conflicting files to a timestamped directory (e.g., `.backups/YYYYMMDD_HHMMSS/`) before stowing.
- **Idempotency**: The installer must be safe to run multiple times. It should detect existing symlinks and skip unnecessary actions.

## Workflow & UX
- **Zero-Friction Bootstrap**: The script must detect the host OS (macOS or Arch) and install its own prerequisites (specifically `gum`) before entering the main interactive flow.
- **Keyboard-Centric**: All prompts and selections should be navigable via arrow keys or Vim motions (`j`/`k`) to maintain a high-productivity workflow.
- **Non-Interactive Options**: Where possible, support flags (e.g., `--all`) to allow for a fully automated, non-interactive installation.
