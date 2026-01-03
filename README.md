```
 _______/  |_  ____   ____ ________
/  ___/\   __\/ __ \_/ __ \\___   /
\___ \  |  | \  ___/\  ___/ /    /
/____  > |__|  \___  >\___  >_____ \
    \/            \/     \/      \/
```

# st-eez dotfiles

Reproducible macOS workstation: shell, editor, terminal, window management.

**Theme:** Tokyo Night (switchable) | **Font:** JetBrainsMono Nerd Font

---

## Prerequisites

```bash
# Homebrew (will prompt for Xcode CLI tools if needed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# GNU Stow
brew install stow  # macOS
# sudo apt install stow  # Ubuntu/Debian
# sudo pacman -S stow    # Arch
```

---

## Quick Start

```bash
git clone https://github.com/st-eez/dotfiles.git ~/dotfiles
cd ~/dotfiles

# Interactive installer (handles Oh-My-Zsh, plugins, stow, and packages)
./install.sh

# Git config (edit name/email after copying)
cp ~/dotfiles/git/.gitconfig.template ~/.gitconfig
```

### Machine-Specific Config

Create `~/.zshrc.local` for paths specific to this machine:

```bash
# Example for Mac with Bitwarden SSH agent
export PATH="$HOME/.antigravity/antigravity/bin:$PATH"
export SSH_AUTH_SOCK="$HOME/Library/Containers/com.bitwarden.desktop/Data/.bitwarden-ssh-agent.sock"
```

### Linux-Only Install

```bash
cd ~/dotfiles
stow zsh tmux nvim ghostty
```

---

## Post-Install

Restart your shell to apply changes:

```bash
exec zsh
```

**First launch:** Open **Aerospace** and **Karabiner Elements** — grant Accessibility access when prompted (System Settings → Privacy & Security → Accessibility).

Edit `~/.gitconfig` with your name and email.

---

## What's Included

| Directory     | Description                                            |
| ------------- | ------------------------------------------------------ |
| `aerospace/`  | Tiling window manager with home/office/laptop profiles |
| `sketchybar/` | Custom menu bar with workspace indicators              |
| `nvim/`       | LazyVim-based Neovim config                            |
| `ghostty/`    | Terminal emulator settings                             |
| `zsh/`        | Oh-My-Zsh + Starship prompt                            |
| `karabiner/`  | Caps Lock → Escape (tap) / Alt (hold)                  |
| `raycast/`    | Keybind search extension                               |
| `borders/`    | Window border styling                                  |
| `Brewfile`    | All packages and apps                                  |

---

## Theming

Switch themes across all apps with one command:

```bash
theme-set tokyo-night    # Default
theme-set gruvbox
theme-set everforest
```

Applies to: SketchyBar, Ghostty, Borders, Neovim, Obsidian, wallpaper.

| Theme       | Background | Accent |
| ----------- | ---------- | ------ |
| Tokyo Night | `#1a1b26`  | Blue   |
| Gruvbox     | `#1d2021`  | Orange |
| Everforest  | `#2d353b`  | Green  |

See [themes/README.md](themes/README.md) for adding custom themes.

---

## Environment Profiles

Three monitor configurations for Aerospace. Local edits use `skip-worktree` (won't show in git status).

| Profile | Keybind      | Setup                         |
| ------- | ------------ | ----------------------------- |
| Home    | `ctrl-alt-h` | BenQ + Pixio + MacBook        |
| Office  | `ctrl-alt-w` | LG Ultrawide + MacBook + ASUS |
| Laptop  | `ctrl-alt-l` | Single display                |

---

## Private Config

- `~/.secrets` – API keys, tokens (not tracked)

---

## Tips

- **Super key:** `option` is the main modifier for all keybinds
- **View all keybinds:** Raycast → "Search Keybinds"
- **Fuzzy find + open in Neovim:** `fnvim`
- **Fuzzy find + cd:** `fcd`
- **Smart cd:** Use `z` instead of `cd` (learns your habits)
- **Git TUI:** `lazygit`
- **Caps Lock:** Tap = Escape, Hold = Alt (hyper key)
