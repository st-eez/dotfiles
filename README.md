```
  ██████ ▄▄▄█████▓▓█████ ▓█████ ▒███████▒
▒██    ▒ ▓  ██▒ ▓▒▓█   ▀ ▓█   ▀ ▒ ▒ ▒ ▄▀░
░ ▓██▄   ▒ ▓██░ ▒░▒███   ▒███   ░ ▒ ▄▀▒░
  ▒   ██▒░ ▓██▓ ░ ▒▓█  ▄ ▒▓█  ▄   ▄▀▒   ░
▒██████▒▒  ▒██▒ ░ ░▒████▒░▒████▒▒███████▒
▒ ▒▓▒ ▒ ░  ▒ ░░   ░░ ▒░ ░░░ ▒░ ░░▒▒ ▓░▒░▒
░ ░▒  ░ ░    ░     ░ ░  ░ ░ ░  ░░░▒ ▒ ░ ▒
```

# st-eez dotfiles

Reproducible macOS workstation: shell, editor, terminal, window management.

**Theme:** Tokyo Night | **Font:** JetBrainsMono Nerd Font

---

## Prerequisites

```bash
# Xcode Command Line Tools
xcode-select --install

# Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Nerd Font (required for icons)
brew install --cask font-jetbrains-mono-nerd-font
```

---

## Quick Start

```bash
git clone https://github.com/st-eez/dotfiles.git ~/dotfiles
cd ~/dotfiles

# Backup existing configs (recommended)
BACKUP_DIR=~/dotfiles_backup_$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR/.config"
cp ~/.zshrc ~/.zprofile ~/.p10k.zsh ~/.tmux.conf "$BACKUP_DIR/" 2>/dev/null
cp -r ~/.config/{aerospace,ghostty,karabiner,sketchybar,nvim,borders} "$BACKUP_DIR/.config/" 2>/dev/null

# Create symlinks
ln -s ~/dotfiles/zsh/.zshrc ~/.zshrc
ln -s ~/dotfiles/zsh/.zprofile ~/.zprofile
ln -s ~/dotfiles/zsh/.p10k.zsh ~/.p10k.zsh
ln -s ~/dotfiles/tmux/.tmux.conf ~/.tmux.conf
ln -s ~/dotfiles/aerospace ~/.config/aerospace
ln -s ~/dotfiles/ghostty ~/.config/ghostty
ln -s ~/dotfiles/karabiner ~/.config/karabiner
ln -s ~/dotfiles/sketchybar ~/.config/sketchybar
ln -s ~/dotfiles/nvim ~/.config/nvim
ln -s ~/dotfiles/borders ~/.config/borders

# Install packages
brew bundle --file Brewfile

# Git config (edit placeholders after copying)
cp ~/dotfiles/git/.gitconfig.template ~/.gitconfig
```

---

## What's Included

| Directory | Description |
|-----------|-------------|
| `aerospace/` | Tiling window manager with home/office/laptop profiles |
| `sketchybar/` | Custom menu bar with workspace indicators |
| `nvim/` | LazyVim-based Neovim config |
| `ghostty/` | Terminal emulator settings |
| `zsh/` | Oh-My-Zsh + Powerlevel10k prompt |
| `karabiner/` | Caps Lock → Escape (tap) / Alt (hold) |
| `raycast/` | Keybind search extension |
| `borders/` | Window border styling |
| `Brewfile` | All packages and apps |

---

## Environment Profiles

Three monitor configurations for Aerospace. Local edits use `skip-worktree` (won't show in git status).

| Profile | Keybind | Setup |
|---------|---------|-------|
| Home | `ctrl-alt-h` | BenQ + Pixio + MacBook |
| Office | `ctrl-alt-w` | LG Ultrawide + MacBook + ASUS |
| Laptop | `ctrl-alt-l` | Single display |

---

## Private Config

Keep sensitive data outside the repo:

- `~/.secrets` – API keys, tokens
- `~/.gitconfig_local` – Git identity
- `~/.gitconfig-WORK` – Work-specific config
