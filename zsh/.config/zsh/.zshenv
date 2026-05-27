# .zshenv runs on EVERY zsh invocation (login/non-login, interactive/script,
# subshells from `zsh -c`, etc). Keep it minimal — env vars only. Heavy work
# (PATH manipulation, plugin loading, completions, prompt) belongs in .zshrc.
#
# Bootstrap chain: ~/.zshenv sets ZDOTDIR=~/.config/zsh then sources this file.

# Codex and terminal UI themes should control their own colors. A stale parent
# environment can leak this into every shell and disable TUI color rendering.
unset NO_COLOR

# Preferred editor for local and remote sessions. Must live here (not .zshrc)
# so non-interactive subshells — `zsh -lc '...'`, scripts, the tmux launcher in
# ghostty/.config/ghostty/launch-tmux.zsh — also see it. Without this, tmux's
# `mode-keys` infer logic falls back to emacs because $EDITOR is unset at
# server start.
if [[ -n $SSH_CONNECTION ]]; then
  export EDITOR='vim'
else
  export EDITOR='nvim'
fi
