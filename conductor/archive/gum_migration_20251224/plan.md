# Track Plan: Migrate `install.sh` to Gum

## Phase 1: Bootstrap & OS Detection [checkpoint: 6331e1d]
This phase ensures the installer can detect the OS and install the `gum` dependency automatically.

- [x] Task: Create `lib/bootstrap.sh` to handle OS detection logic for macOS, Arch, and Ubuntu/Mint.
- [x] Task: Implement `install_gum()` in `lib/bootstrap.sh` using `brew`, `pacman`, or `apt` (including repo setup for apt).
- [x] Task: Create a new entry point script `install_v2.sh` that triggers the bootstrap and verifies `gum` availability.
- [~] Task: Conductor - User Manual Verification 'Bootstrap & OS Detection' (Protocol in workflow.md)

## Phase 2: UI Refactor with Tokyo Night [checkpoint: e9b76f0]
This phase replaces the custom Bash UI with themed Gum components.

- [x] Task: Define Tokyo Night hex color variables (Blue: #7aa2f7, Purple: #bb9af7, Red: #f7768e, etc.) in `lib/theme.sh`.
- [x] Task: Implement `ui_header()` and `ui_confirm()` using `gum style` and `gum confirm`.
- [x] Task: Implement `ui_select_packages()` using `gum choose --no-limit`. Ensure the list is dynamically filtered to show only packages compatible with the detected OS (e.g., hide `sketchybar` on Linux).
- [x] Task: Connect the new UI flow to the main loop in `install_v2.sh`.
- [~] Task: Conductor - User Manual Verification 'UI Refactor with Tokyo Night' (Protocol in workflow.md)

## Phase 3: Core Logic & Safety (Backups) [checkpoint: 485951c]
This phase implements the actual installation and file management logic across all OSs.

- [x] Task: Implement `install_package()` helper that abstracts `brew`, `pacman`, and `apt` commands behind a `gum spin` interface.
- [x] Task: Implement the automated timestamped backup logic in `lib/utils.sh` to move conflicts to `.backups/<timestamp>/`.
- [x] Task: Implement `stow_package()` which checks for conflicts, performs backups if needed, and runs `stow`.
- [x] Task: Verify the installation loop works for both "Brew-only" and "Stow-compatible" packages.
- [~] Task: Conductor - User Manual Verification 'Core Logic & Safety' (Protocol in workflow.md)

## Phase 4: Finalization & Cutover [checkpoint: e39d51e]
This phase performs the final polish and replaces the old script.

- [x] Task: Add a final "Summary" screen using `gum style` showing success/failure counts.
- [x] Task: Perform a full dry-run on macOS and a Linux VM (if possible) to verify cross-platform parity.
- [x] Task: Replace the original `install.sh` with the new version.
- [~] Task: Conductor - User Manual Verification 'Finalization & Cleanup' (Protocol in workflow.md)
