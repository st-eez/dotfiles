# Product Guide - Steez Dotfiles

## Initial Concept
i want to change my install.sh to use gum. we will need to make sure we load / install gum prior to running the install.sh. think hard

## Target Audience
- Primary: Steve Dimakos (Personal use and reproducibility across multiple macOS and Linux/Arch machines).

## Core Goals
- **Modern Installer UI**: Replace the custom Bash UI components in `install.sh` with [Charm Gum](https://github.com/charmbracelet/gum) for a more professional, interactive, and polished CLI experience.
- **Robust Bootstrapping**: Automatically detect the operating system and install the `gum` dependency (via Homebrew on macOS or Pacman on Arch) before proceeding with the installation.
- **Aesthetic Consistency**: Fully theme the `gum` components using Tokyo Night hex codes to ensure the installer matches the overall system aesthetic.
- **High Productivity & Reproducibility**: Maintain a keyboard-centric workflow and ensure a new workstation can be set up in minutes with zero manual UI friction.
- **Cross-Platform Reliability**: Ensure the installer logic remains consistent and functional across both macOS and Linux (Arch).

## Key Features
- **Interactive CLI UX**: Utilize `gum` for spinners, confirmation dialogs, multi-select menus, and filtered lists.
- **Automated Dependency Management**: Self-bootstrapping installer that handles its own prerequisites.
- **Self-Healing Runtime Environments**: Automatically detects and installs missing runtimes (Node.js, Python) before attempting to install global packages (npm, pip).
- **Smart Arch Linux Support**: Automatically bootstraps the `yay` AUR helper if no helper is found.
- **Universal Font Setup**: Automates the installation of Nerd Fonts (JetBrains Mono) across macOS, Arch, and Debian-based systems.
- **Tokyo Night Visuals**: Custom `gum` styling to align with the project's color palette.
- **Modular Installer Logic**: Refactored script structure for better maintainability and error handling.
