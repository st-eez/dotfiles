alias fcd='file=$(fzf) && [[ -n "$file" ]] && cd "$(dirname "$file")"'
alias fnvim='file=$(fzf) && [[ -n "$file" ]] && nvim "$file"'
alias lg='lazygit'

# eza alias (if installed)
if command -v eza >/dev/null; then
  alias ls='eza --header --long --icons --group-directories-first'
fi
