alias fcd='cd "$(dirname "$(fzf)")"'
alias fnvim='nvim "$(fzf)"'
alias lg='lazygit'

# eza alias (if installed)
if command -v eza >/dev/null; then
  alias ls='eza --header --long --icons --group-directories-first'
fi
