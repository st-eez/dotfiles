```
 _______/  |_  ____   ____ ________
/  ___/\   __\/ __ \_/ __ \\___   /
\___ \  |  | \  ___/\  ___/ /    /
/____  > |__|  \___  >\___  >_____ \
    \/            \/     \/      \/
```

# st-eez dotfiles

Reproducible macOS workstation: shell, editor, terminal, window management.

**Theme:** Tokyo Night | **Font:** JetBrainsMono Nerd Font

---

## Prerequisites

```bash
# Homebrew (will prompt for Xcode CLI tools if needed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

---

## Quick Start

```bash
git clone https://github.com/st-eez/dotfiles.git ~/dotfiles
cd ~/dotfiles

# Install Oh-My-Zsh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended

# Install Powerlevel10k theme
git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ~/.oh-my-zsh/custom/themes/powerlevel10k

# Install plugins
git clone https://github.com/zsh-users/zsh-autosuggestions ~/.oh-my-zsh/custom/plugins/zsh-autosuggestions
git clone https://github.com/zsh-users/zsh-syntax-highlighting ~/.oh-my-zsh/custom/plugins/zsh-syntax-highlighting

# Backup and remove existing configs
BACKUP_DIR=~/dotfiles_backup_$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR/.config"
mv ~/.zshrc ~/.zprofile ~/.p10k.zsh ~/.tmux.conf "$BACKUP_DIR/" 2>/dev/null
mv ~/.config/{aerospace,ghostty,karabiner,sketchybar,nvim,borders} "$BACKUP_DIR/.config/" 2>/dev/null

# Create symlinks
mkdir -p ~/.config
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
ln -s ~/dotfiles/zsh/.oh-my-zsh/custom/aliases.zsh ~/.oh-my-zsh/custom/aliases.zsh

# Install packages
brew bundle --file Brewfile

# Git config (edit name/email after copying)
cp ~/dotfiles/git/.gitconfig.template ~/.gitconfig
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
