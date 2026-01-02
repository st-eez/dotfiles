#!/usr/bin/env bash

# Utility Functions
# Depends on: lib/theme.sh

# ============================================================================
# CROSS-PLATFORM SYMLINK RESOLUTION
# Provides portable path canonicalization for macOS (BSD) and Linux (GNU)
# ============================================================================

# Resolve symlink to absolute canonical path
# Works on: macOS 13+, Linux, BSD with coreutils
# Usage: resolve_symlink_target "/path/to/symlink"
# Output: Prints absolute path to stdout
# Returns: 0 on success, 1 if not a symlink or resolution failed
resolve_symlink_target() {
    local path="$1"
    
    # Must be a symlink
    [[ ! -L "$path" ]] && return 1
    
    # Priority 1: realpath (available on macOS 13+, Linux coreutils)
    if command -v realpath >/dev/null 2>&1; then
        realpath "$path" 2>/dev/null && return 0
    fi
    
    # Priority 2: greadlink -f (macOS with Homebrew coreutils)
    if command -v greadlink >/dev/null 2>&1; then
        greadlink -f "$path" 2>/dev/null && return 0
    fi
    
    # Priority 3: GNU readlink -f (Linux)
    if readlink -f "$path" 2>/dev/null; then
        return 0
    fi
    
    # Priority 4: Python fallback (universally available)
    if command -v python3 >/dev/null 2>&1; then
        python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$path" 2>/dev/null && return 0
    fi
    if command -v python >/dev/null 2>&1; then
        python -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$path" 2>/dev/null && return 0
    fi
    
    # Priority 5: Pure shell fallback (POSIX-compliant)
    local current="$path" resolved dir_part max_depth=50
    
    while [[ -L "$current" ]] && (( max_depth-- > 0 )); do
        dir_part="$(dirname "$current")"
        resolved=$(readlink "$current")  # BSD-compatible (no -f)
        [[ "$resolved" != /* ]] && resolved="$dir_part/$resolved"
        current="$resolved"
    done
    
    # Canonicalize final path
    if [[ -d "$current" ]]; then
        (cd "$current" 2>/dev/null && pwd)
    elif [[ -e "$current" ]]; then
        (cd "$(dirname "$current")" 2>/dev/null && echo "$(pwd)/$(basename "$current")")
    else
        echo "$current"  # Target doesn't exist but return resolved path
    fi
}

# Get absolute canonical path of any file/directory (not just symlinks)
# Usage: get_absolute_path "/some/path"
# Output: Prints absolute path to stdout
get_absolute_path() {
    local path="$1"
    
    # For symlinks, resolve them fully
    if [[ -L "$path" ]]; then
        resolve_symlink_target "$path" && return 0
    fi
    
    # For directories
    if [[ -d "$path" ]]; then
        (cd "$path" 2>/dev/null && pwd)
        return
    fi
    
    # For files
    if [[ -e "$path" ]]; then
        local dir base
        dir="$(dirname "$path")"
        base="$(basename "$path")"
        (cd "$dir" 2>/dev/null && echo "$(pwd)/$base")
        return
    fi
    
    # Path doesn't exist - return as-is
    echo "$path"
}

# ============================================================================
# STOW TARGET ENUMERATION
# ============================================================================

# Get list of files a stow package would create as symlinks
# Respects .stow-local-ignore patterns (simple glob matching)
# Usage: get_stow_targets "package_name"
# Output: Newline-separated paths relative to $HOME
get_stow_targets() {
    local pkg="$1"
    local pkg_dir="$DOTFILES_DIR/$pkg"
    local ignore_file="$pkg_dir/.stow-local-ignore"
    
    [[ ! -d "$pkg_dir" ]] && return 1
    
    # Build ignore pattern list from .stow-local-ignore
    local -a ignore_patterns=()
    if [[ -f "$ignore_file" ]]; then
        while IFS= read -r line || [[ -n "$line" ]]; do
            # Skip empty lines and comments
            [[ -z "$line" || "$line" == \#* ]] && continue
            # Trim whitespace
            line="${line#"${line%%[![:space:]]*}"}"
            line="${line%"${line##*[![:space:]]}"}"
            [[ -n "$line" ]] && ignore_patterns+=("$line")
        done < "$ignore_file"
    fi
    
    # Find all files and symlinks in package directory
    local abs_path rel_path
    while IFS= read -r -d '' abs_path; do
        rel_path="${abs_path#$pkg_dir/}"
        
        # Skip stow control files
        [[ "$rel_path" == ".stow-local-ignore" ]] && continue
        [[ "$rel_path" == ".stow-global-ignore" ]] && continue
        
        # Check against ignore patterns (simple prefix/glob matching)
        local should_ignore=false
        for pattern in "${ignore_patterns[@]}"; do
            # Match if rel_path starts with pattern or equals pattern
            if [[ "$rel_path" == "$pattern" ]] || \
               [[ "$rel_path" == "$pattern"/* ]] || \
               [[ "$(basename "$rel_path")" == "$pattern" ]]; then
                should_ignore=true
                break
            fi
        done
        [[ "$should_ignore" == true ]] && continue
        
        echo "$rel_path"
    done < <(find "$pkg_dir" -mindepth 1 \( -type f -o -type l \) -print0 2>/dev/null)
}

# ============================================================================
# GENERAL UTILITIES
# ============================================================================

# Cross-platform sed in-place editing
# Usage: sed_inplace 'pattern' file
# Handles GNU sed (Linux) vs BSD sed (macOS) differences
sed_inplace() {
    if sed --version >/dev/null 2>&1; then
        # GNU sed (Linux)
        sed -i "$@"
    else
        # BSD sed (macOS)
        sed -i '' "$@"
    fi
}

# Backup conflicting files/folders
# Usage: backup_conflicts "package_name" "conflict_list_string" ["timestamp"]
# Returns: 0 if all backups succeeded, 1 if any failed
backup_conflicts() {
    local pkg="$1"
    local conflicts="$2"
    local timestamp="${3:-$(date +%Y%m%d_%H%M%S)}"
    local backup_base="$DOTFILES_DIR/.backups/$timestamp"
    local failed=0

    gum style --foreground "$THEME_SUBTEXT" "Backing up conflicts for $pkg..."

    # Read newline-separated conflicts properly (avoids word splitting issues)
    while IFS= read -r rel_path; do
        [[ -z "$rel_path" ]] && continue

        local target="$HOME/$rel_path"
        local backup_path="$backup_base/$pkg/$rel_path"

        if [[ -e "$target" && ! -L "$target" ]]; then
            if ! mkdir -p "$(dirname "$backup_path")"; then
                gum style --foreground "$THEME_ERROR" "  Failed to create backup dir: $rel_path"
                ((failed++))
                continue
            fi
            if mv "$target" "$backup_path"; then
                gum style --foreground "$THEME_SUBTEXT" --faint "  Moved: ~/$rel_path"
            else
                gum style --foreground "$THEME_ERROR" "  Failed to backup: $rel_path"
                ((failed++))
            fi
        fi
    done <<< "$conflicts"

    return $((failed > 0 ? 1 : 0))
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
