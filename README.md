```          __                        
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

### Step 0 – Confirm prerequisites

- Install the Xcode command line tools if they are missing:

  ```bash
  xcode-select --install
  ```

- Install [Homebrew](https://brew.sh/) when it is not already available:

  ```bash
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  ```

### Step 1 – Install shell baseline

```bash
export RUNZSH=no
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
git clone --depth=1 https://github.com/romkatv/powerlevel10k ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
git clone https://github.com/zsh-users/zsh-syntax-highlighting ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
```

### Step 2 – Clone the repository

```bash
export DOTFILES_DIR=$HOME/dotfiles   # change this if you prefer another location
git clone https://github.com/st-eez/dotfiles.git "$DOTFILES_DIR"
cd "$DOTFILES_DIR"
```

### Step 3 – Back up any existing configs (skip if this is a fresh machine)

```bash
for file in .zshrc .zprofile .p10k.zsh; do
  [ -e "$HOME/$file" ] && mv "$HOME/$file" "$HOME/${file}.backup.$(date +%Y%m%d%H%M%S)"
done
```

### Step 4 – Symlink the tracked files into `$HOME`

```bash
ln -sfn "$DOTFILES_DIR/zsh/.zshrc" ~/.zshrc
ln -sfn "$DOTFILES_DIR/zsh/.zprofile" ~/.zprofile
ln -sfn "$DOTFILES_DIR/zsh/.p10k.zsh" ~/.p10k.zsh
mkdir -p ~/.config/ghostty
ln -sfn "$DOTFILES_DIR/ghostty/config" ~/.config/ghostty/config
```

Use `ln -sfn` so re-running the command updates the links without prompting.

### Step 5 – Install CLI tools, casks, and VS Code extensions

```bash
brew bundle --file "$DOTFILES_DIR/Brewfile"
```

### Step 6 – Reload and configure

```bash
exec zsh
p10k configure   # optional: customize the prompt if you have not done so already
```

---

## Verify the setup

- `ls -l ~/.zshrc ~/.zprofile ~/.p10k.zsh ~/.config/ghostty/config` should all point back to the repo.
- `which nvim`, `which fzf`, `which gh` should resolve to Homebrew paths after `brew bundle`.
- `git status` inside `$DOTFILES_DIR` should show a clean tree once you are satisfied with the install.

---

## Repository map

- [`Brewfile`](Brewfile) – authoritative list of Homebrew taps, formulae, casks, and VS Code extensions.
- [`mac_setup.md`](mac_setup.md) – extended narrative describing each macOS app, tweak, and menu bar tool.
- [`zsh/`](zsh) – `oh-my-zsh` configuration, prompt (`.p10k.zsh`), and login shell settings.
- [`ghostty/config`](ghostty/config) – Ghostty terminal theme (TokyoNight Night) and window preferences.
- [`nvim/`](nvim) – LazyVim-based Neovim configuration plus pinned plugin versions and formatting rules.

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

- Run `brew bundle --file Brewfile` to install everything from productivity apps (Raycast, Obsidian) to window managers (Rectangle, JankyBorders).
- Cross-reference [`mac_setup.md`](mac_setup.md) for context on why each app is included and how it is configured.

---

## Maintenance & updates

1. Pull the latest changes:

   ```bash
   cd "$DOTFILES_DIR"
   git pull
   ```

2. Refresh Homebrew packages:

   ```bash
   brew update
   brew bundle --file "$DOTFILES_DIR/Brewfile"
   ```

3. Re-link configs if you add new files:

   ```bash
   ln -sfn "$DOTFILES_DIR/<relative-path>" ~/target
   ```

4. Audit for unused brew entries periodically:

   ```bash
   brew bundle --file "$DOTFILES_DIR/Brewfile" cleanup --force
   ```

---

## Troubleshooting

- **Symlinks missing?** Re-run the commands from Step 4 and confirm with `ls -l`.
- **Prompt looks wrong?** Execute `p10k configure` to rebuild the theme.
- **Brew install failed?** Ensure the taps in `Brewfile` are reachable, then rerun `brew bundle`.
- **Need to reset to defaults?** Restore from the backups created in Step 3 or remove the symlink and recreate it.

---

## Private machine-specific config

Keep sensitive data out of the repo by creating local overrides:

1. `~/.gitconfig_local` – Git user/email and signing details.
2. `~/.shell_env_local` – tokens, API keys, VPN credentials, or other secrets.
3. Any additional per-machine app configuration (password managers, VPN profiles) should remain untracked.

---

## Automation options

- Want everything scripted? Consider [Dotbot](https://github.com/anishathalye/dotbot) or [GNU Stow](https://www.gnu.org/software/stow/) to manage symlinks and post-install hooks.
- Whichever tool you pick, point it at the same directory structure used in this repository so you maintain one source of truth.

---

## License

Personal configuration files. Reuse at your own risk and verify that you are not copying secrets or machine-specific data along the way.
