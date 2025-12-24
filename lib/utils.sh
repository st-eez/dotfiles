#!/usr/bin/env bash

# Utility Functions
# Depends on: lib/theme.sh

# Backup conflicting files/folders
# Usage: backup_conflicts "package_name" "conflict_list_string"
backup_conflicts() {
    local pkg="$1"
    local conflicts="$2"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_base="$DOTFILES_DIR/.backups/$timestamp"
    
    gum style --foreground "$THEME_SUBTEXT" "Backing up conflicts for $pkg..."

    for rel_path in $conflicts; do
        local target="$HOME/$rel_path"
        local backup_path="$backup_base/$pkg/$rel_path"
        
        if [[ -e "$target" && ! -L "$target" ]]; then
            mkdir -p "$(dirname "$backup_path")"
            mv "$target" "$backup_path"
            gum style --foreground "$THEME_SUBTEXT" --faint "  Moved: ~/$rel_path -> .backups/.../$rel_path"
        fi
    done
}
