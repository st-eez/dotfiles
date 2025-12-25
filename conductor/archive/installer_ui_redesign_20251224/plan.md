# Track Plan: Modernize Installer UI

## Phase 1: Component Library & Logging [checkpoint: bd42b12]
This phase builds the foundational UI primitives for a consistent "Pro Dashboard" look.

- [x] Task: Create `lib/logging.sh` with standardized functions (`log_title`, `log_section`, `log_success`, `log_failure`, `log_info`) that use `gum style` and `printf` for perfect alignment. `log_failure` should support an optional error detail argument and use a distinct red theme.
- [x] Task: Create a `ui_playground.sh` to verify these logging functions produce a clean, aligned list.
- [x] Task: Conductor - User Manual Verification 'Logging Style' (Protocol in workflow.md)

## Phase 2: Splash Screen & Menu [checkpoint: 2d25fba]
This phase polishes the entry point of the installer.

- [x] Task: Implement `ui_splash` in `lib/ui.sh` with ASCII art and system metadata.
- [x] Task: Refine the Main Menu in `install.sh` to use the new splash screen and standardize prompts using `gum choose`, removing all legacy `read -p` commands.
- [~] Task: Conductor - User Manual Verification 'Splash & Menu' (Protocol in workflow.md)

## Phase 3: Installation Loop & Summary [checkpoint: edd6e0f]
This phase applies the new design to the core logic.

- [x] Task: Refactor the main loop in `install.sh` to use `lib/logging.sh` functions instead of raw `gum` calls.
- [x] Task: Implement logic to track installation results in a CSV format (`/tmp/steez_install.csv`).
- [x] Task: Replace the text-based summary with a rich `gum table` rendered from the CSV.
- [~] Task: Conductor - User Manual Verification 'Final UI' (Protocol in workflow.md)