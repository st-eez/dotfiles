# Specification: Migrate `install.sh` to Gum

## 1. Overview
This track focuses on modernizing the existing `install.sh` script by replacing its custom Bash UI logic with [Charm Gum](https://github.com/charmbracelet/gum). The goal is to provide a highly interactive, aesthetically pleasing (Tokyo Night themed), and robust installation experience that works consistently across macOS, Arch Linux, and Ubuntu/Mint.

## 2. Goals
*   **Modern UI:** Replace text-based menus with `gum`'s interactive lists, spinners, and confirm dialogs.
*   **Visual Consistency:** Apply the Tokyo Night color palette to all `gum` components.
*   **Robust Bootstrapping:** Automatically detect the OS and install `gum` (and other core deps) before showing the UI.
*   **Safety:** Implement automated timestamped backups for conflicting files.
*   **Maintainability:** Refactor the monolithic script into modular functions.

## 3. Technical Requirements

### 3.1 OS Support
The script must detect and support:
*   **macOS:** Uses Homebrew (`brew install gum`).
*   **Arch Linux:** Uses Pacman (`pacman -S gum`) or AUR helper.
*   **Ubuntu/Debian:** Uses APT (`apt install gum` - requires charm repo setup).

### 3.2 Bootstrapping Logic
1.  Check for `gum` binary.
2.  If missing, detect OS.
3.  Install `gum` using the system package manager.
    *   *Critical:* If installation fails, abort immediately with a clear error message.

### 3.3 UI Components (Gum)
*   **Spinners:** Use `gum spin` for all long-running tasks (installing packages, backing up files).
*   **Confirmation:** Use `gum confirm` for "Proceed?" dialogs.
*   **Selection:** Use `gum choose --no-limit` (multi-select) for package selection.
    *   **Dynamic Filtering:** The list of available packages must be filtered based on the detected OS.
        *   **macOS:** Show all packages (including `aerospace`, `sketchybar`, `borders`).
        *   **Linux:** Filter out macOS-specific tools and show only cross-platform compatible packages (e.g., `nvim`, `zsh`, `ghostty`).
*   **Styling:**
    *   Primary Color: `#7aa2f7` (Blue)
    *   Secondary Color: `#bb9af7` (Purple)
    *   Error Color: `#f7768e` (Red)
    *   Success Color: `#9ece6a` (Green)
    *   Background: `#1a1b26` (Dark Blue)

### 3.4 Installation Logic
*   **Core Dependencies:** `stow`, `git`, and the system package manager (`homebrew` for macOS, `pacman` for Arch, `apt` for Ubuntu/Mint). Fail fast if these cannot be installed or are missing.
*   **Package Installation:** Loop through selected packages using the appropriate system command:
    *   **macOS:** `brew install`
    *   **Arch:** `pacman -S` (or AUR helper)
    *   **Ubuntu/Mint:** `apt install`
    *   Check if installed before attempting.
    *   Log failures but do not abort the entire process (Skip & Report).
*   **Stowing:**
    *   Check for conflicts.
    *   If conflict exists -> Move to `.backups/YYYYMMDD_HHMMSS/` -> Stow.
    *   If no conflict -> Stow.

## 4. Migration Plan
The migration will be performed in phases to ensure stability:
1.  **Phase 1: Bootstrap & Setup:** Create the wrapper logic to install `gum`.
2.  **Phase 2: UI Refactor:** Replace existing `echo`/`read` logic with `gum` commands.
3.  **Phase 3: Core Logic & Backups:** Implement the robust `stow` and backup logic.
4.  **Phase 4: Cleanup & Polish:** Remove old code and finalize theming.
