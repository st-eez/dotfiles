# Specification: Modernize Installer UI

## 1. Overview
This track aims to elevate the `install.sh` user interface to a "Pro Dashboard" aesthetic. The goal is a clean, aligned, and professional CLI experience that feels like a native binary (e.g., Bun, Vercel).

## 2. Design Goals
*   **"Pro Dashboard" Metaphor:**
    *   **During Install:** A clean, scrolling list of actions. Each line represents a package.
    *   **Alignment:** Status icons and details must be perfectly vertically aligned.
    *   **Post Install:** A rich, interactive summary table.
*   **Visual Hierarchy:**
    *   **Splash:** Big, bold ASCII art.
    *   **Headers:** Gradient text.
    *   **Logs:** Dimmed text for details, bright colors for status.
*   **Tokyo Night Integration:** Strict adherence to the color palette.

## 3. Technical Requirements
*   **Logging Library:** A centralized `lib/logging.sh` to enforce consistency.
*   **Gum Table:** Use `gum table` for the final summary (requires CSV/TSV input).
*   **Zero Raw ANSI:** All styling must be handled via variables or `gum style` to avoid breakage.

## 4. Success Criteria
*   The installer output is perfectly aligned (no jagged edges).
*   The summary table allows scrolling/inspecting results.
*   The overall feel is "fast" and "clean".