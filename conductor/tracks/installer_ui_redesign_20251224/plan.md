# Track Plan: Modernize Installer UI

## Phase 1: Component Library & Logging
This phase builds the foundational UI primitives for a consistent "Pro Dashboard" look.

- [x] Task: Create `lib/logging.sh` with standardized functions (`log_title`, `log_section`, `log_success`, `log_failure`, `log_info`) that use `gum style` and `printf` for perfect alignment. `log_failure` should support an optional error detail argument and use a distinct red theme.
- [x] Task: Create a `ui_playground.sh` to verify these logging functions produce a clean, aligned list.
- [x] Task: Conductor - User Manual Verification 'Logging Style' (Protocol in workflow.md)

## Phase 2: Splash Screen & Menu
This phase polishes the entry point of the installer.

- [x] Task: Implement `ui_splash` in `lib/ui.sh` with ASCII art and system metadata.
- [x] Task: Refine the Main Menu in `install.sh` to use the new splash screen and standardize prompts using `gum choose`, removing all legacy `read -p` commands.
- [ ] Task: Conductor - User Manual Verification 'Splash & Menu' (Protocol in workflow.md)

## Phase 3: Installation Loop & Summary
This phase applies the new design to the core logic.

- [ ] Task: Refactor the main loop in `install.sh` to use `lib/logging.sh` functions instead of raw `gum` calls.
- [ ] Task: Implement logic to track installation results in a CSV format (`/tmp/steez_install.csv`).
- [ ] Task: Replace the text-based summary with a rich `gum table` rendered from the CSV.
- [ ] Task: Conductor - User Manual Verification 'Final UI' (Protocol in workflow.md)