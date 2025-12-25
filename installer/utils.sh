#!/usr/bin/env bash

# Utility Functions
# Depends on: lib/theme.sh

# Backup conflicting files/folders
# Usage: backup_conflicts "package_name" "conflict_list_string" ["timestamp"]
backup_conflicts() {
    local pkg="$1"
    local conflicts="$2"
    local timestamp="${3:-$(date +%Y%m%d_%H%M%S)}"
    local backup_base="$DOTFILES_DIR/.backups/$timestamp"
    
    gum style --foreground "$THEME_SUBTEXT" "Backing up conflicts for $pkg..."

    # Read newline-separated conflicts properly (avoids word splitting issues)
    while IFS= read -r rel_path; do
        [[ -z "$rel_path" ]] && continue

        local target="$HOME/$rel_path"
        local backup_path="$backup_base/$pkg/$rel_path"

        if [[ -e "$target" && ! -L "$target" ]]; then
            mkdir -p "$(dirname "$backup_path")"
            mv "$target" "$backup_path"
            gum style --foreground "$THEME_SUBTEXT" --faint "  Moved: ~/$rel_path -> .backups/.../$rel_path"
        fi
    done <<< "$conflicts"
}

# Pre-emptively backup a file if it exists and is not a symlink
# Usage: ensure_backup "path/to/file" "package_name"
ensure_backup() {
    local target="$1"
    local pkg="$2"
    
    # If it exists and is NOT a symlink
    if [[ -f "$target" && ! -L "$target" ]]; then
        gum style --foreground "$THEME_WARNING" "Existing local config found: $target"
        
        # Auto-backup if non-interactive or confirmed
        if ui_confirm "Backup this file to allow $pkg installation?"; then
            local timestamp=$(date +%Y%m%d_%H%M%S)
            local backup_dir="$DOTFILES_DIR/.backups/$timestamp/$pkg"
            mkdir -p "$backup_dir"
            mv "$target" "$backup_dir/"
            gum style --foreground "$THEME_SUBTEXT" --faint "  Moved to .backups/.../$(basename "$target")"
            return 0
        else
            return 1
        fi
    fi
    return 0
}
