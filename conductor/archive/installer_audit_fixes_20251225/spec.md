# Spec: Installer Resiliency Audit Fixes

## Overview
This track addresses specific defects identified in an external code audit of the `install.sh` resiliency update. The focus is on safety (guarding `mktemp`), idempotency (better font checks), and error handling (Git config writes).

## Functional Requirements

### 1. `mktemp` Safety (installer/install.sh)
- **Bootstrap AUR Helper:**
    - Verify `mktemp -d` succeeds before proceeding.
    - Only attempt `rm -rf` if the variable is set and non-empty.
- **Debian Font Install:**
    - Verify `mktemp` succeeds.
    - Ensure cleanup happens reliably.

### 2. Debian Font Idempotency & Resilience (installer/install.sh)
- **Idempotency:** Replace the single filename check (`JetBrainsMonoNerdFont-Regular.ttf`) with a pattern-based check (`JetBrainsMono*NerdFont-*.ttf`) to account for version naming changes.
- **`fc-cache`:** If `fc-cache` is missing (e.g., minimal containers), warn the user but do NOT fail the installation, as the fonts are physically present.

### 3. Git Config Write Safety (installer/git_setup.sh)
- **Error Handling:** Every file operation (`rm`, `mv`, `echo` redirect) must be guarded.
- **Failure:** If any write operation fails, the function must return `1` and log a specific error.

## Acceptance Criteria
- [ ] `bootstrap_aur_helper` fails gracefully if `mktemp` fails.
- [ ] Debian font installation detects existing fonts using a pattern match.
- [ ] Debian font installation succeeds even if `fc-cache` is missing (with a warning).
- [ ] `setup_git_config` returns error code `1` if it cannot write to `~/.gitconfig`.
