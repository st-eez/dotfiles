# Implementation Plan: Raycast Extensions in Dotfiles Installer

**Created:** 2026-01-01  
**Status:** Pending Implementation

## Summary

Add Raycast extension building and import guidance to the dotfiles installer. The `raycast` package will bundle core extensions (keybinds, theme-switcher), while `raycast-prompt-optimizer` remains a separate optional package.

---

## Package Structure

| Package                    | Type     | What's Included                                            | Full Setup? | Custom Selection |
| -------------------------- | -------- | ---------------------------------------------------------- | ----------- | ---------------- |
| `raycast`                  | Core     | Raycast App + **keybinds** + **theme-switcher** extensions | Yes         | Visible          |
| `raycast-prompt-optimizer` | Optional | AI prompt optimizer extension                              | Yes         | Visible          |

**Rationale:**

- `raycast` bundles core extensions because keybinds + theme-switcher are essential for dotfiles functionality
- `raycast-prompt-optimizer` is separate since it's an AI tool, not core to dotfiles

---

## Technical Constraint

Raycast has **no programmatic extension install API**. Extensions must be manually imported via Raycast GUI:

1. `npm install && npm run build` — Compiles extension
2. Open Raycast → "Import Extension" → Select folder
3. Extension is permanently available

The installer will build extensions and display clear instructions for the one-time manual import.

---

## Files to Change

| File                                    | Action     | Description                                  |
| --------------------------------------- | ---------- | -------------------------------------------- |
| `raycast/extensions/browser-bookmarks/` | **DELETE** | Now in official Raycast Store                |
| `installer/install.sh`                  | **MODIFY** | Add build functions, post-stow hooks         |
| `installer/config.sh`                   | **MODIFY** | Add `raycast-prompt-optimizer` to MACOS_PKGS |
| `install.sh` (root)                     | **MODIFY** | Display import instructions at end           |
| `AGENTS.md`                             | **MODIFY** | Update WHERE TO LOOK table                   |

---

## Detailed Changes

### 1. Delete browser-bookmarks

```bash
rm -rf raycast/extensions/browser-bookmarks/
```

**Reason:** Extension was merged into official Raycast Store. Confirmed via GitHub API — exists at `raycast/extensions` repo with `"owner": "raycast"`.

---

### 2. Changes to `installer/install.sh`

#### 2.1 Add Global Tracking Array

Insert at top of file (after initial comments):

```bash
# Track built Raycast extensions for post-install instructions
declare -a RAYCAST_BUILT_EXTENSIONS=()
```

#### 2.2 Add `build_raycast_extension()` Function

Insert after `setup_opencode_plugins()` function (~line 214):

```bash
# Build a Raycast extension
# Usage: build_raycast_extension "extension_name" "display_name"
# Returns: 0 on success, 1 on failure
build_raycast_extension() {
    local ext_name="$1"
    local display_name="$2"
    local ext_dir="$DOTFILES_DIR/raycast/extensions/$ext_name"

    if [[ ! -d "$ext_dir" ]]; then
        gum style --foreground "$THEME_WARNING" "  Extension not found: $ext_name"
        return 1
    fi

    if [[ ! -f "$ext_dir/package.json" ]]; then
        gum style --foreground "$THEME_WARNING" "  No package.json in $ext_name"
        return 1
    fi

    if ! command -v npm >/dev/null 2>&1; then
        gum style --foreground "$THEME_WARNING" "  npm not found - skipping $display_name"
        gum style --foreground "$THEME_SUBTEXT" "  Run manually: cd $ext_dir && npm install && npm run build"
        return 0
    fi

    gum style --foreground "$THEME_PRIMARY" "  ◆ Building $display_name..."

    # Install dependencies
    if ! gum spin --spinner dot --title "Installing dependencies..." -- \
        bash -c "cd '$ext_dir' && npm install 2>/dev/null"; then
        gum style --foreground "$THEME_ERROR" "  Failed to install dependencies for $display_name"
        return 1
    fi

    # Build extension
    if ! gum spin --spinner dot --title "Building extension..." -- \
        bash -c "cd '$ext_dir' && npm run build 2>/dev/null"; then
        gum style --foreground "$THEME_ERROR" "  Failed to build $display_name"
        return 1
    fi

    gum style --foreground "$THEME_SUCCESS" "  ✓ $display_name built"
    RAYCAST_BUILT_EXTENSIONS+=("$ext_name:$display_name")
    return 0
}
```

#### 2.3 Add `setup_raycast_core_extensions()` Function

```bash
# Build keybinds and theme-switcher extensions (called after raycast stow)
setup_raycast_core_extensions() {
    gum style --foreground "${THEME_ACCENT:-#73daca}" \
        "  Building Raycast core extensions..."

    build_raycast_extension "keybinds" "Keybinds" || true
    build_raycast_extension "theme-switcher" "Theme Switcher" || true
}
```

#### 2.4 Add `show_raycast_import_instructions()` Function

```bash
# Display import instructions for built Raycast extensions
show_raycast_import_instructions() {
    [[ ${#RAYCAST_BUILT_EXTENSIONS[@]} -eq 0 ]] && return 0

    echo ""
    gum style --foreground "${THEME_SECONDARY}" \
        "  ┌─ MANUAL STEP: Import Raycast Extensions ──────┐"
    gum style --foreground "${THEME_SUBTEXT}" \
        "  │                                               │"
    gum style --foreground "${THEME_SUBTEXT}" \
        "  │ Extensions built and ready to import:         │"

    for ext_entry in "${RAYCAST_BUILT_EXTENSIONS[@]}"; do
        local ext_display="${ext_entry#*:}"
        gum style --foreground "${THEME_SUBTEXT}" \
            "  │   • $ext_display"
    done

    gum style --foreground "${THEME_SUBTEXT}" \
        "  │                                               │"
    gum style --foreground "${THEME_SUBTEXT}" \
        "  │ To import into Raycast (one-time setup):      │"
    gum style --foreground "${THEME_SUBTEXT}" \
        "  │   1. Open Raycast (⌘ + Space)                 │"
    gum style --foreground "${THEME_SUBTEXT}" \
        "  │   2. Type 'Import Extension' and press Enter  │"
    gum style --foreground "${THEME_SUBTEXT}" \
        "  │   3. Select folder from:                      │"
    gum style --foreground "${THEME_SUBTEXT}" \
        "  │      ~/dotfiles/raycast/extensions/<name>     │"
    gum style --foreground "${THEME_SUBTEXT}" \
        "  │   4. Repeat for each extension                │"
    gum style --foreground "${THEME_SECONDARY}" \
        "  └────────────────────────────────────────────────┘"
    echo ""
}
```

#### 2.5 Modify `stow_package()` Case Statement

In the post-stow hooks section (~line 877), extend the case statement:

```bash
# 3. Post-stow hooks for packages that need additional setup
case "$pkg" in
    opencode)
        setup_opencode_plugins || return 1
        ;;
    raycast)
        setup_raycast_core_extensions || true
        ;;
    raycast-prompt-optimizer)
        gum style --foreground "${THEME_ACCENT:-#73daca}" \
            "  Building Prompt Optimizer extension..."
        build_raycast_extension "prompt-optimizer" "Prompt Optimizer" || true
        return 3  # No config to stow - extension only
        ;;
esac
```

---

### 3. Changes to `installer/config.sh`

#### 3.1 Add to MACOS_PKGS Array

Update the array (~line 7-16):

```bash
export MACOS_PKGS=(
    aerospace
    autoraise
    bitwarden
    borders
    karabiner
    raycast
    raycast-prompt-optimizer
    sketchybar
    themes
)
```

#### 3.2 Add Package Description

In `get_pkg_description()` function (~line 177-216):

```bash
raycast-prompt-optimizer) echo "AI prompt optimizer (Raycast)" ;;
```

#### 3.3 Add Binary Name Mapping

In `get_binary_name()` function (~line 148-173):

```bash
raycast-prompt-optimizer) echo "" ;;  # No binary - Raycast extension only
```

---

### 4. Changes to Root `install.sh`

Add before the `ui_summary` call (find the location where summary is displayed):

```bash
# Show Raycast extension import instructions if any were built
if [[ ${#RAYCAST_BUILT_EXTENSIONS[@]} -gt 0 ]]; then
    show_raycast_import_instructions
fi
```

---

### 5. Update `AGENTS.md`

In the WHERE TO LOOK table, replace browser-bookmarks reference:

```markdown
| Raycast keybinds ext | `raycast/extensions/keybinds/` | Built with raycast package |
| Raycast theme-switcher | `raycast/extensions/theme-switcher/` | Built with raycast package |
| Prompt Optimizer | `raycast/extensions/prompt-optimizer/` | Separate package, see CLAUDE.md there |
```

Remove the browser-bookmarks line entirely.

---

## Order of Operations

1. Delete `raycast/extensions/browser-bookmarks/` directory
2. Add tracking array to `installer/install.sh`
3. Add `build_raycast_extension()` function
4. Add `setup_raycast_core_extensions()` function
5. Add `show_raycast_import_instructions()` function
6. Modify `stow_package()` with raycast and raycast-prompt-optimizer hooks
7. Add `raycast-prompt-optimizer` to `installer/config.sh` MACOS_PKGS
8. Add package description in `get_pkg_description()`
9. Add binary name mapping in `get_binary_name()`
10. Update root `install.sh` to show import instructions
11. Update `AGENTS.md` documentation
12. Test full installer flow

---

## User Experience

### Full Setup

- Auto-installs: `raycast` (app + keybinds + theme-switcher) + `raycast-prompt-optimizer`
- Builds all 3 extensions
- Shows import instructions for all 3

### Custom Selection: Picking `raycast` Only

- Installs Raycast app
- Builds keybinds + theme-switcher extensions
- Shows import instructions for 2 extensions

### Custom Selection: Picking `raycast-prompt-optimizer` Only

- Builds prompt-optimizer extension only
- Shows import instructions for 1 extension

---

## Post-Install Instructions (What User Sees)

```
  ┌─ MANUAL STEP: Import Raycast Extensions ──────┐
  │                                               │
  │ Extensions built and ready to import:         │
  │   • Keybinds                                  │
  │   • Theme Switcher                            │
  │   • Prompt Optimizer                          │
  │                                               │
  │ To import into Raycast (one-time setup):      │
  │   1. Open Raycast (⌘ + Space)                 │
  │   2. Type 'Import Extension' and press Enter  │
  │   3. Select folder from:                      │
  │      ~/dotfiles/raycast/extensions/<name>     │
  │   4. Repeat for each extension                │
  └────────────────────────────────────────────────┘
```

---

## Testing Verification

### Pre-Implementation

```bash
# Verify extensions exist
ls -la raycast/extensions/*/package.json
```

### Post-Implementation

1. **Test extension build manually:**

   ```bash
   cd raycast/extensions/keybinds
   npm install && npm run build
   ls dist/  # Should exist
   ```

2. **Test full installer:**

   ```bash
   ./install.sh
   # Select: Full Setup
   # Verify: All 3 extensions build, instructions display
   ```

3. **Test custom selection:**

   ```bash
   ./install.sh
   # Select: Custom → raycast only
   # Verify: keybinds + theme-switcher build, prompt-optimizer skipped
   ```

4. **Test Raycast import:**
   - Open Raycast → "Import Extension"
   - Navigate to `~/dotfiles/raycast/extensions/keybinds`
   - Verify extension loads and works

---

## References

- Raycast Docs: [Getting Started](https://developers.raycast.com/basics/getting-started)
- Raycast Docs: [Install an Extension](https://developers.raycast.com/basics/install-an-extension)
- Import Extension command: Built-in Raycast command for loading local extensions
