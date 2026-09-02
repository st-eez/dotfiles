# .zshenv runs on EVERY zsh invocation (login/non-login, interactive/script,
# subshells from `zsh -c`, etc). Keep it minimal — env vars only. Heavy work
# (PATH manipulation, plugin loading, completions, prompt) belongs in .zshrc.
#
# Bootstrap chain: ~/.zshenv sets ZDOTDIR=~/.config/zsh then sources this file.

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

# ssh forwards TERM but not COLORTERM, and sshd would need AcceptEnv to allow it
# through anyway. Without it, TUIs that probe COLORTERM (Claude Code, delta,
# bat) fall back to the 256-color cube and quantize their palette — colors look
# washed out over ssh but correct locally, where the terminal sets it natively.
# tmux panes get this from `set-environment -g COLORTERM` in the tmux config;
# this covers plain ssh sessions. Guarded on TERM so cron jobs and `zsh -c`
# scripts running under dumb/unset TERM don't start emitting color escapes.
if [[ -n $TERM && $TERM != dumb ]]; then
  export COLORTERM=truecolor
fi
. "$HOME/.cargo/env"
