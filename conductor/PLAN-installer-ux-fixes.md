# PLAN: Installer UX Fixes

**Created:** 2025-12-31  
**Updated:** 2025-12-31  
**Status:** ✅ IMPLEMENTED  
**Branch:** main

---

## Overview

This plan addresses UX and reliability issues in the dotfiles installer discovered on Linux Mint 22.2:

1. **Log leakage** - Messages break clean TUI during spinners
2. **LocalSend failure** - Flatpak method unreliable on Mint
3. **OpenCode sudo** - Password prompt appears mid-spinner
4. **Security hardening** - Checksums, safe temp files, proper quoting

---

## Issues Analysis

### Issue 1: Log Leakage During Spinners

**Problem:** `gum style` messages inside native installer functions print to stdout/stderr, "leaking" through the spinner UI.

**Evidence:**

```
◆ localsend
    ███████████▓░░░░░░░░░░░ [14/26]  53%
Using native installer for localsend...      ← LEAKED
  Installing LocalSend via Flatpak...        ← LEAKED
  Failed to install LocalSend                ← LEAKED
```

**Root cause:** Native installer functions contain their own `gum style` calls for status messages. When called via `eval "$target"` in the `native)` case (line 732), these print directly instead of being captured.

**Affected functions:**
| Function | File:Line | Issue |
|----------|-----------|-------|
| `install_node_nodesource()` | install.sh:52-72 | 4 gum style calls |
| `install_nvim_tarball()` | install.sh:74-126 | 4 gum style calls |
| `install_ghostty_appimage()` | install.sh:128-171 | 5 gum style calls |
| `install_starship_script()` | install.sh:173-186 | 3 gum style calls |
| `install_localsend_flatpak()` | install.sh:188-212 | 4 gum style calls |

**Solution:** Remove all UI calls from native functions. They should be silent, returning only exit codes. The parent `install_package()` handles all UI.

---

### Issue 2: LocalSend Installation Failure

**Problem:** Flatpak-only installation fails on Linux Mint 22.2.

**Root cause analysis:**

1. **Flathub not configured** - Mint ships Flatpak but Flathub remote often isn't added by default
2. **First-time setup** - Flatpak sometimes requires logout/relogin after adding remotes
3. **Sandboxing issues** - Flatpak's sandbox restricts file access (LocalSend can't access ~/Downloads easily)
4. **Permission model** - System-level Flatpak installs may require polkit authentication

**Why .deb is the correct primary method:**
| Aspect | .deb | Flatpak |
|--------|------|---------|
| Native to Mint/Debian | ✅ Yes | ❌ Additional runtime |
| File access | ✅ Full | ⚠️ Sandboxed |
| Install complexity | ✅ Simple `dpkg -i` | ⚠️ Remote + app install |
| Official support | ✅ GitHub releases | ✅ Flathub |
| Auto-updates | ❌ Manual | ✅ Yes |

**Decision:** Use .deb as primary (reliability), Flatpak as fallback (for users who prefer it).

**Solution:**

- Rename function to `install_localsend_linux()`
- Fetch latest version dynamically from GitHub API (like `install_ghostty_appimage`)
- Try .deb first, fall back to Flatpak

---

### Issue 3: OpenCode sudo Prompt Mid-Spinner

**Problem:** Password prompt appears during spinner, hidden from user.

**Evidence:**

```
◆ opencode
    ███████████████▓░░░░░░░░ [18/26]  69%
[sudo] password for steez:                   ← LEAKED/HIDDEN
Failed to install opencode
```

**Root cause:** `sudo -v` at line 676 caches credentials, but:

1. npm global install can take longer than sudo timeout (5 min default)
2. The `sudo -v` is too far from the actual `gum spin` execution
3. npm may invoke sudo internally for postinstall scripts

**Solution:** Move `sudo -v` immediately before the `gum spin` call, not at the top of the case block.

---

### Issue 4: Security Audit Findings

| Severity   | Finding                  | Location                                                     | Fix                                  |
| ---------- | ------------------------ | ------------------------------------------------------------ | ------------------------------------ |
| **HIGH**   | No checksum verification | install.sh:91-102 (nvim), 157-164 (ghostty), 613-628 (fonts) | Add SHA256 verification              |
| **MEDIUM** | Predictable temp file    | install.sh:80                                                | Use `mktemp`                         |
| **MEDIUM** | Unquoted `$stow_opts`    | install.sh:929                                               | Use array expansion                  |
| **LOW**    | eval for trap restore    | install.sh:45-46                                             | Document why safe (controlled input) |

---

## Phase 1: Fix Log Leakage [estimate: 30 min]

### Tasks

- [ ] **1.1** Remove `gum style` calls from `install_node_nodesource()` (install.sh:52-72)
- [ ] **1.2** Remove `gum style` calls from `install_nvim_tarball()` (install.sh:74-126)
- [ ] **1.3** Remove `gum style` calls from `install_ghostty_appimage()` (install.sh:128-171)
- [ ] **1.4** Remove `gum style` calls from `install_starship_script()` (install.sh:173-186)
- [ ] **1.5** Remove `gum style` calls from `install_localsend_flatpak()` (install.sh:188-212)
- [ ] **1.6** Remove "Using native installer" message from native case (install.sh:731)
- [ ] **1.7** Ensure all native functions return 0 on success, 1 on failure

### Implementation Pattern

**Before:**

```bash
install_node_nodesource() {
    gum style --foreground "$THEME_SECONDARY" "  Adding NodeSource repo for Node 20..."
    if ! curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1; then
        gum style --foreground "$THEME_ERROR" "  Failed to add NodeSource repo"
        return 1
    fi
    gum style --foreground "$THEME_SECONDARY" "  Installing Node.js 20..."
    if ! sudo apt install -y nodejs >/dev/null 2>&1; then
        gum style --foreground "$THEME_ERROR" "  Failed to install Node.js"
        return 1
    fi
    gum style --foreground "$THEME_SUCCESS" "  Installed Node.js $(node --version)"
    return 0
}
```

**After:**

```bash
# Silent native installer - UI handled by install_package()
install_node_nodesource() {
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1 || return 1
    sudo apt install -y nodejs >/dev/null 2>&1 || return 1
    return 0
}
```

---

## Phase 2: Fix LocalSend Installation [estimate: 45 min]

### Tasks

- [ ] **2.1** Rename `install_localsend_flatpak()` → `install_localsend_linux()` (install.sh:188)
- [ ] **2.2** Update `get_alt_install_method()` to reference new function name (config.sh:180)
- [ ] **2.3** Implement dynamic version fetch from GitHub API
- [ ] **2.4** Implement .deb download with architecture detection (x86_64/arm64)
- [ ] **2.5** Implement .deb installation via `sudo apt install`
- [ ] **2.6** Implement Flatpak fallback (preserve existing logic)
- [ ] **2.7** Add cleanup for temp files on all exit paths

### Implementation

```bash
# Install LocalSend on Debian/Ubuntu/Mint
# Primary: .deb package (native, no sandboxing)
# Fallback: Flatpak (if .deb fails)
install_localsend_linux() {
    local tmp_deb=""

    # Cleanup on exit
    trap '[[ -n "$tmp_deb" ]] && rm -f "$tmp_deb"' RETURN

    # 1. Get latest version from GitHub API
    local version
    version=$(curl -fsSL "https://api.github.com/repos/localsend/localsend/releases/latest" | \
        grep -oP '"tag_name":\s*"v?\K[^"]+' 2>/dev/null)
    [[ -z "$version" ]] && return 1

    # 2. Determine architecture
    local arch
    case "$(uname -m)" in
        x86_64)  arch="x86-64" ;;
        aarch64) arch="arm64" ;;
        *)       return 1 ;;
    esac

    # 3. Try .deb installation (preferred)
    local deb_url="https://github.com/localsend/localsend/releases/download/v${version}/LocalSend-${version}-linux-${arch}.deb"
    tmp_deb=$(mktemp --suffix=.deb) || return 1

    if curl -fsSL -o "$tmp_deb" "$deb_url" 2>/dev/null; then
        if sudo apt install -y "$tmp_deb" >/dev/null 2>&1; then
            return 0
        fi
    fi

    # 4. Fallback to Flatpak
    if ! command -v flatpak >/dev/null 2>&1; then
        sudo apt install -y flatpak >/dev/null 2>&1 || return 1
        flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo 2>/dev/null
    fi

    flatpak install -y flathub org.localsend.localsend_app >/dev/null 2>&1 || return 1
    return 0
}
```

---

## Phase 3: Fix OpenCode sudo Prompt [estimate: 15 min]

### Tasks

- [ ] **3.1** Move `sudo -v` from line 676 to immediately before `gum spin` call
- [ ] **3.2** Apply same pattern to corepack case (lines 703-705)
- [ ] **3.3** Apply same pattern to pacman cases (lines 660-662, 687-689)

### Implementation Pattern

**Before:**

```bash
npm)
    # ... npm availability check ...
    if [[ "$OS" == "linux" ]]; then
        sudo -v  # Too early - may expire before spin
        cmd="sudo npm install -g $target"
    else
        cmd="npm install -g $target"
    fi
    label="npm: installing $pkg"
    ;;
```

**After:**

```bash
npm)
    # ... npm availability check ...
    if [[ "$OS" == "linux" ]]; then
        cmd="sudo npm install -g $target"
    else
        cmd="npm install -g $target"
    fi
    label="npm: installing $pkg"
    ;;

# Then in execution section (around line 792):
if [[ "$cmd" == sudo* ]]; then
    sudo -v  # Refresh immediately before execution
fi
if gum spin --spinner dot --title "$label" -- "${cmd_parts[@]}"; then
```

---

## Phase 4: Security Hardening [estimate: 1 hour]

### Tasks

- [ ] **4.1** Use `mktemp` for CSV file (install.sh:80)
- [ ] **4.2** Add SHA256 checksum verification for Neovim tarball
- [ ] **4.3** Add SHA256 checksum verification for Ghostty AppImage
- [ ] **4.4** Add SHA256 checksum verification for Nerd Fonts
- [ ] **4.5** Refactor `stow $stow_opts` to use array expansion (install.sh:926-929)
- [ ] **4.6** Add comment documenting why eval is safe for trap restoration (install.sh:45-46)

### 4.1 Safe Temp File for CSV

**Before (install.sh:80):**

```bash
csv_file="${TMPDIR:-/tmp}/steez_install.csv"
```

**After:**

```bash
csv_file=$(mktemp "${TMPDIR:-/tmp}/steez_install.XXXXXX.csv")
```

### 4.2-4.4 Checksum Verification Pattern

```bash
# Helper function for checksum verification
verify_checksum() {
    local file="$1"
    local expected="$2"
    local actual
    actual=$(sha256sum "$file" | cut -d' ' -f1)
    [[ "$actual" == "$expected" ]]
}

# Usage in install_nvim_tarball():
local expected_sha="<sha256-from-release>"
if ! verify_checksum "$tarball" "$expected_sha"; then
    rm -f "$tarball"
    return 1
fi
```

**Note:** For dynamic versions (Ghostty, LocalSend), fetch checksum from `.sha256` file in release assets or skip verification with a comment explaining why.

### 4.5 Stow Array Expansion

**Before (install.sh:926-929):**

```bash
local stow_opts="--dir=$DOTFILES_DIR --target=$HOME --restow"
[[ "$pkg" == "nvim" ]] && stow_opts="$stow_opts --no-folding"
if stow $stow_opts "$pkg" 2>/dev/null; then
```

**After:**

```bash
local -a stow_args=(--dir="$DOTFILES_DIR" --target="$HOME" --restow)
[[ "$pkg" == "nvim" ]] && stow_args+=(--no-folding)
if stow "${stow_args[@]}" "$pkg" 2>/dev/null; then
```

### 4.6 Document Eval Safety

```bash
# Restore original traps and cleanup
# SECURITY NOTE: eval is safe here because values come from `trap -p`,
# which outputs shell-escaped trap commands from the current shell.
# No user input is involved.
eval "${old_int_trap:-trap - INT}"
eval "${old_term_trap:-trap - TERM}"
```

---

## Testing Checklist

### Functional Tests (Linux Mint 22.2)

- [ ] Full install with clean TUI (no leaked messages)
- [ ] LocalSend installs via .deb successfully
- [ ] OpenCode installs without mid-spinner sudo prompt
- [ ] Node.js installs silently (NodeSource)
- [ ] Neovim installs silently (tarball)
- [ ] Ghostty installs silently (AppImage)
- [ ] Starship installs silently (official script)

### Regression Tests (macOS)

- [ ] Homebrew packages install normally
- [ ] No changes to macOS-specific paths
- [ ] Stow operations work correctly

### Security Tests

- [ ] CSV file created in /tmp with random suffix
- [ ] Neovim checksum verified before extraction
- [ ] Ghostty checksum verified (if available)
- [ ] Stow command handles edge cases (spaces in paths - theoretical)

---

## Verification Protocol

After implementation, run:

```bash
# 1. Clean slate test (uninstall test packages first)
sudo apt remove -y localsend 2>/dev/null
sudo npm uninstall -g opencode 2>/dev/null

# 2. Run installer
./install.sh

# 3. Verify clean output (no leaked messages)
# 4. Verify packages installed
command -v localsend && echo "LocalSend: OK"
command -v opencode && echo "OpenCode: OK"

# 5. Check CSV location
ls -la /tmp/steez_install.*.csv
```

---

## Rollback Strategy

1. **Git revert:** `git checkout HEAD~1 -- installer/install.sh installer/config.sh`
2. **Package removal:**
   - LocalSend: `sudo apt remove localsend` or `flatpak uninstall org.localsend.localsend_app`
   - OpenCode: `sudo npm uninstall -g opencode`
3. **Temp files:** Auto-cleaned by OS or `rm /tmp/steez_install.*.csv`

---

## Files Modified

| File                   | Changes                                                                    |
| ---------------------- | -------------------------------------------------------------------------- |
| `installer/install.sh` | Phases 1-4: Silent native functions, LocalSend rewrite, sudo fix, security |
| `installer/config.sh`  | Phase 2: Update function reference                                         |
| `install.sh`           | Phase 4: mktemp for CSV                                                    |

---

## Estimated Total Time

| Phase                | Estimate     |
| -------------------- | ------------ |
| Phase 1: Log Leakage | 30 min       |
| Phase 2: LocalSend   | 45 min       |
| Phase 3: sudo Fix    | 15 min       |
| Phase 4: Security    | 1 hour       |
| Testing              | 30 min       |
| **Total**            | **~3 hours** |
