```
 _______/  |_  ____   ____ ________
/  ___/\   __\/ __ \_/ __ \\___   /
\___ \  |  | \  ___/\  ___/ /    /
/____  > |__|  \___  >\___  >_____ \
    \/            \/     \/      \/
```

# st-eez dotfiles

Fully reproducible macOS workstation setup: shell, editor, terminal, apps, and defaults that stay in sync across machines.

---

## Quick Start

All commands assume macOS 13+ with the default `zsh` shell. Substitute your preferred paths if you keep dotfiles somewhere other than `~/dotfiles`.

### Clone the repository

```bash
git clone https://github.com/st-eez/dotfiles.git ~/dotfiles
cd ~/dotfiles
```

### Setup

```bash
# Backup existing dotfiles (recommended)
BACKUP_DIR=~/dotfiles_backup_$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR/.config"
cp ~/.zshrc ~/.zprofile ~/.p10k.zsh ~/.tmux.conf "$BACKUP_DIR/" 2>/dev/null
cp -r ~/.config/{aerospace,ghostty,karabiner,sketchybar,nvim,borders} "$BACKUP_DIR/.config/" 2>/dev/null

# Remove existing dotfiles
rm ~/.zshrc ~/.zprofile ~/.p10k.zsh ~/.tmux.conf
rm -rf ~/.config/{aerospace,ghostty,karabiner,sketchybar,nvim,borders}

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

# Set up git config (see git/README.md for details)
cp ~/dotfiles/git/.gitconfig.template ~/.gitconfig
# Edit ~/.gitconfig to replace placeholders with your information
```

---

## Verify the setup

- `which nvim`, `which fzf`, `which rg` should resolve to Homebrew paths
- `git status` inside the repo should be clean; any local edits belong under `~/dotfiles` and the symlinks will pick them up immediately

---

## Repository map

- [`Brewfile`](Brewfile) – authoritative list of Homebrew taps, formulae, casks, and VS Code extensions.
- [`mac_setup.md`](mac_setup.md) – extended narrative describing each macOS app, tweak, and menu bar tool.
- [`zsh/`](zsh) – `oh-my-zsh` configuration, prompt (`.p10k.zsh`), and login shell settings.
- [`tmux/`](tmux) – tmux terminal multiplexer configuration.
- [`git/`](git) – Git configuration template (`.gitconfig.template`) with setup instructions.
- [`ghostty/config`](ghostty/config) – Ghostty terminal theme (TokyoNight Night) and window preferences.
- [`raycast/`](raycast) – Raycast configuration and custom keybinds extension (AeroSpace workspace bindings, application shortcuts).
- [`aerospace/`](aerospace) – AeroSpace tiling window manager configuration with environment-specific variants (home, office, laptop).
- [`borders/`](borders) – JankyBorders configuration for window visual customization.
- [`karabiner/`](karabiner) – Karabiner-Elements keyboard remapping and shortcut customization.
- [`sketchybar/`](sketchybar) – SketchyBar configuration plus helper scripts and AeroSpace integration plugins.
- [`nvim/`](nvim) – LazyVim-based Neovim configuration plus pinned plugin versions and formatting rules.
- [`scripts/`](scripts) – Installation utilities (WIP).

---

## Principles

- Keep installs reproducible: every dependency lives in the repository or the `Brewfile`.
- Bias toward keyboard-first workflows with minimal UI distraction.
- Make state obvious: prompts and dashboards surface actionable information immediately.
- Keep secrets and machine-specific overrides outside version control.
- Build on lightweight defaults that you can extend per machine when needed.

---

## Tooling highlights

### Shell

- `zsh` with `oh-my-zsh` and the `powerlevel10k` prompt.
- Core plugins: [`zsh-autosuggestions`](https://github.com/zsh-users/zsh-autosuggestions) and [`zsh-syntax-highlighting`](https://github.com/zsh-users/zsh-syntax-highlighting).
- Additional aliases and exports live directly in [`zsh/.zshrc`](zsh/.zshrc) and [`zsh/.zprofile`](zsh/.zprofile).

### Neovim

- [`nvim/`](nvim) bootstraps LazyVim, locks plugin versions via `lazy-lock.json`, and enforces formatting with [`stylua.toml`](nvim/stylua.toml).
- Treesitter, LSP, and UI defaults are tuned for the Tokyo Night theme.

### Terminal (Ghostty)

- [`ghostty/config`](ghostty/config) sets the TokyoNight Night scheme and 90% background opacity for a translucent look.
- Fonts and cursor behavior complement the Neovim and Zsh themes for a cohesive setup.

### Applications

- Run `brew bundle --file Brewfile` to install everything from productivity apps (Raycast, Obsidian) to window managers (AeroSpace, JankyBorders).
- Cross-reference [`mac_setup.md`](mac_setup.md) for context on why each app is included and how it is configured.

### AeroSpace + SketchyBar

- AeroSpace configuration lives in [`aerospace/`](aerospace) with environment-specific variants for different monitor setups (home, office, laptop).
- SketchyBar integrates with AeroSpace through [`sketchybar/plugins/aerospace.sh`](sketchybar/plugins/aerospace.sh) to display workspace information.
- SketchyBar config lives in [`sketchybar/sketchybarrc`](sketchybar/sketchybarrc) with plugin scripts under [`sketchybar/plugins`](sketchybar/plugins).

---

## Maintenance & updates

1. Pull the latest changes:

   ```bash
   cd ~/dotfiles
   git pull
   ```

2. Refresh Homebrew packages:

   ```bash
   cd ~/dotfiles
   brew update
    brew bundle --file Brewfile
   ```

3. Re-link configs if you add new files:

   ```bash
   ln -sfn ~/dotfiles/<relative-path> ~/target
   ```

4. Audit for unused brew entries periodically:

   ```bash
   brew bundle --file "$DOTFILES_DIR/Brewfile" cleanup --force
   ```

---

## Troubleshooting

- **Prompt looks wrong?** Execute `p10k configure` to rebuild the theme.
- **Brew install failed?** Rerun once network connectivity is solid.

---

## Private machine-specific config

Keep sensitive data out of the repo by creating local overrides:

1. `~/.gitconfig_local` – Git user/email and signing details.
2. `~/.shell_env_local` – tokens, API keys, VPN credentials, or other secrets.
3. Any additional per-machine app configuration (password managers, VPN profiles) should remain untracked.

---

## Environment-specific config (skip-worktree)

Some files need to change based on your environment (home, office, laptop) but shouldn't be committed. The `aerospace/aerospace.toml` monitor configuration is set to use `git skip-worktree`:

```bash
# Already configured - verify with:
git ls-files -v | grep "^S"

# To edit monitor assignments for your environment:
# Just edit aerospace/aerospace.toml - changes won't show in git status
```

**Re-enable tracking if needed:**

```bash
# Temporarily re-enable to commit updates
git update-index --no-skip-worktree aerospace/aerospace.toml
git add aerospace/aerospace.toml
git commit -m "Update aerospace config"

# Re-enable skip-worktree
git update-index --skip-worktree aerospace/aerospace.toml
```

BetterTouchTool

- Allow window dragging on OPT.
