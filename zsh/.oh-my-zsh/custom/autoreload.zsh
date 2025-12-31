# Auto-reload Powerlevel10k on theme change
# Sources ~/.p10k.zsh when ~/.config/current-theme changes

# macOS only constraint: Theme switching system is macOS-specific
[[ "$OSTYPE" != darwin* ]] && return

# Use zsh/stat module for fast builtin stat (avoids forking 'stat' process on every prompt)
zmodload -F zsh/stat b:zstat

_check_theme_change() {
  # Theme state file managed by theme-set script
  local theme_file="$HOME/.config/current-theme"
  
  # Skip if theme file doesn't exist
  [[ ! -f "$theme_file" ]] && return

  local -A stat_hash
  # Use builtin zstat to get mtime
  if ! zstat -H stat_hash "$theme_file" 2>/dev/null; then
    return
  fi
  
  local current_mtime="${stat_hash[mtime]}"

  # Initialize on first run
  if [[ -z "$_LAST_THEME_MTIME" ]]; then
    _LAST_THEME_MTIME="$current_mtime"
    return
  fi

  # Check if modified
  if [[ "$current_mtime" != "$_LAST_THEME_MTIME" ]]; then
    # Update state immediately to prevent loops
    _LAST_THEME_MTIME="$current_mtime"
    
    # Reload p10k config
    # This sources ~/.p10k.zsh which sources the new theme file
    if [[ -f ~/.p10k.zsh ]]; then
      source ~/.p10k.zsh
      
      # Note: We do NOT call 'zle reset-prompt' here because we are in precmd,
      # so the prompt hasn't been drawn yet. It will be drawn immediately after
      # this function returns, using the new config we just sourced.
    fi
  fi
}

# Add to precmd hook (runs before every prompt)
autoload -Uz add-zsh-hook
add-zsh-hook precmd _check_theme_change
