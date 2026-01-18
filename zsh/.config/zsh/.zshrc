# OS detection
case "$(uname -s)" in
  Darwin) IS_MACOS=true ;;
  *)      IS_MACOS=false ;;
esac

# XDG Base Directory Specification
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
export XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"

# Use system ripgrep for Claude Code (faster, compiled for this arch)
export USE_BUILTIN_RIPGREP=0

# Ensure cache directory exists for zcompdump (one-time creation)
[[ ! -d "$XDG_CACHE_HOME/zsh" ]] && mkdir -p "$XDG_CACHE_HOME/zsh"

# If you come from bash you might have to change your $PATH.
# export PATH=$HOME/bin:$HOME/.local/bin:/usr/local/bin:$PATH

# Path to your Oh My Zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# Custom folder under ZDOTDIR (not default ~/.oh-my-zsh/custom)
export ZSH_CUSTOM="${ZDOTDIR:-$HOME/.config/zsh}/custom"

# Prevent .zcompdump clutter in $HOME
export ZSH_COMPDUMP="$XDG_CACHE_HOME/zsh/zcompdump-${HOST}-${ZSH_VERSION}"

# Set name of the theme to load --- if set to "random", it will
# load a random theme each time Oh My Zsh is loaded, in which case,
# to know which specific one was loaded, run: echo $RANDOM_THEME
# See https://github.com/ohmyzsh/ohmyzsh/wiki/Themes
ZSH_THEME=""

# Set list of themes to pick from when loading at random
# Setting this variable when ZSH_THEME=random will cause zsh to load
# a theme from this variable instead of looking in $ZSH/themes/
# If set to an empty array, this variable will have no effect.
# ZSH_THEME_RANDOM_CANDIDATES=( "robbyrussell" "agnoster" )

# Uncomment the following line to use case-sensitive completion.
# CASE_SENSITIVE="true"

# Uncomment the following line to use hyphen-insensitive completion.
# Case-sensitive completion must be off. _ and - will be interchangeable.
# HYPHEN_INSENSITIVE="true"

# Uncomment one of the following lines to change the auto-update behavior
# zstyle ':omz:update' mode disabled  # disable automatic updates
# zstyle ':omz:update' mode auto      # update automatically without asking
# zstyle ':omz:update' mode reminder  # just remind me to update when it's time

# Uncomment the following line to change how often to auto-update (in days).
# zstyle ':omz:update' frequency 13

# Uncomment the following line if pasting URLs and other text is messed up.
# DISABLE_MAGIC_FUNCTIONS="true"

# Uncomment the following line to disable colors in ls.
 DISABLE_LS_COLORS="true"

# Uncomment the following line to disable auto-setting terminal title.
# DISABLE_AUTO_TITLE="true"

# Uncomment the following line to enable command auto-correction.
# ENABLE_CORRECTION="true"

# Uncomment the following line to display red dots whilst waiting for completion.
# You can also set it to another string to have that shown instead of the default red dots.
# e.g. COMPLETION_WAITING_DOTS="%F{yellow}waiting...%f"
# Caution: this setting can cause issues with multiline prompts in zsh < 5.7.1 (see #5765)
COMPLETION_WAITING_DOTS="true"

# Uncomment the following line if you want to disable marking untracked files
# under VCS as dirty. This makes repository status check for large repositories
# much, much faster.
# DISABLE_UNTRACKED_FILES_DIRTY="true"

# Uncomment the following line if you want to change the command execution time
# stamp shown in the history command output.
# You can set one of the optional three formats:
# "mm/dd/yyyy"|"dd.mm.yyyy"|"yyyy-mm-dd"
# or set a custom format using the strftime function format specifications,
# see 'man strftime' for details.
HIST_STAMPS="%m/%d/%Y %I:%M %p"

# Would you like to use another custom folder than $ZSH/custom?
# ZSH_CUSTOM=/path/to/new-custom-folder

# Which plugins would you like to load?
# Standard plugins can be found in $ZSH/plugins/
# Custom plugins may be added to $ZSH_CUSTOM/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
plugins=(git zsh-autosuggestions zsh-syntax-highlighting)

source $ZSH/oh-my-zsh.sh

# Use eza's built-in defaults (matches Linux/Omarchy behavior)
unset LS_COLORS
zstyle ':completion:*' list-colors ''

# User configuration

# export MANPATH="/usr/local/man:$MANPATH"

# You may need to manually set your language environment
# export LANG=en_US.UTF-8

# Preferred editor for local and remote sessions
if [[ -n $SSH_CONNECTION ]]; then
  export EDITOR='vim'
else
  export EDITOR='nvim'
fi

# Compilation flags
# export ARCHFLAGS="-arch $(uname -m)"

# Set personal aliases, overriding those provided by Oh My Zsh libs,
# plugins, and themes. Aliases can be placed here, though Oh My Zsh
# users are encouraged to define aliases within a top-level file in
# the $ZSH_CUSTOM folder, with .zsh extension. Examples:
# - $ZSH_CUSTOM/aliases.zsh
# - $ZSH_CUSTOM/macos.zsh
# For a full list of active aliases, run `alias`.
#
# Example aliases
# alias zshconfig="mate ~/.zshrc"
# alias ohmyzsh="mate ~/.oh-my-zsh"


# PATH setup (before tools that depend on it)
export PATH="$HOME/.local/bin:$PATH"

# Initialize zoxide (if installed)
if command -v zoxide >/dev/null 2>&1; then
  eval "$(zoxide init zsh)"
fi


# fzf keybindings and completion (cross-platform)
if command -v fzf >/dev/null; then
  if $IS_MACOS && command -v brew >/dev/null; then
    FZF_PREFIX="$(brew --prefix fzf 2>/dev/null)"
    [[ -n "$FZF_PREFIX" ]] && source "$FZF_PREFIX/shell/key-bindings.zsh" 2>/dev/null
    [[ -n "$FZF_PREFIX" ]] && source "$FZF_PREFIX/shell/completion.zsh" 2>/dev/null
  else
    # Linux: Arch
    [[ -f /usr/share/fzf/key-bindings.zsh ]] && source /usr/share/fzf/key-bindings.zsh
    [[ -f /usr/share/fzf/completion.zsh ]] && source /usr/share/fzf/completion.zsh
    # Linux: Debian/Ubuntu
    [[ -f /usr/share/doc/fzf/examples/key-bindings.zsh ]] && source /usr/share/doc/fzf/examples/key-bindings.zsh
    [[ -f /usr/share/doc/fzf/examples/completion.zsh ]] && source /usr/share/doc/fzf/examples/completion.zsh
  fi
fi

# Source external tool additions (nvm, pyenv, opencode, rustup, etc.)
# These tools append to ~/.zshrc which is NOT tracked.
# We source it here so their additions still work.
#
# Guards:
# - The -ef check prevents self-sourcing if files are the same inode
# - The _STEEZ_SOURCING_HOME_ZSHRC guard prevents infinite loop if ~/.zshrc
#   sources back to us (common during migrations or from old shim setups)
if [[ -f "$HOME/.zshrc" && ! "$HOME/.zshrc" -ef "${ZDOTDIR:-$HOME}/.zshrc" ]]; then
    if (( ! ${+_STEEZ_SOURCING_HOME_ZSHRC} )); then
        typeset -g _STEEZ_SOURCING_HOME_ZSHRC=1
        source "$HOME/.zshrc"
        unset _STEEZ_SOURCING_HOME_ZSHRC
    fi
fi

# Source local secrets (not tracked in git)
[[ -f ~/.secrets ]] && source ~/.secrets

# Source machine-specific config (not tracked)
[[ -f ~/.zshrc.local ]] && source ~/.zshrc.local

# Prevent sudo nvim from breaking plugin permissions
sudo() {
  if [[ "$1" == "nvim" ]]; then
    command sudo -H "$@"
  else
    command sudo "$@"
  fi
}

# bun completions
[ -s "$HOME/.bun/_bun" ] && source "$HOME/.bun/_bun"

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Initialize Starship prompt (if installed)
if command -v starship >/dev/null 2>&1; then
  eval "$(starship init zsh)"
fi

# Force consistent completion colors cross-platform
# Apple zsh and Arch zsh have different compiled defaults when list-colors is empty
# Explicitly set directories to ANSI 34 (blue) to match eza and ensure consistency
zstyle ':completion:*' list-colors 'di=34'

. "$HOME/.local/share/../bin/env"
