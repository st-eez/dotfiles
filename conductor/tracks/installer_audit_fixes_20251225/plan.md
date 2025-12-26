# Plan: Installer Resiliency Audit Fixes

## Phase 1: Safety & Idempotency [checkpoint: 2e9a5d7]
- [x] Task: Fix `mktemp` safety in `bootstrap_aur_helper` and `install_nerd_fonts` (installer/install.sh).
- [x] Task: Improve Debian font idempotency and `fc-cache` resilience (installer/install.sh).
- [x] Task: Add strict error handling to `setup_git_config` (installer/git_setup.sh).
- [x] Task: Guard template read in `setup_git_config` (installer/git_setup.sh).
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)
