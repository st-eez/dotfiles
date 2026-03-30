---
name: steez-setup-browser-cookies
version: 1.0.0
description: |
  Import cookies from your real Chromium browser into the headless browse session.
  Opens an interactive picker UI where you select which cookie domains to import.
  Use before QA testing authenticated pages. Use when asked to "import cookies",
  "login to the site", or "authenticate the browser". (steez)
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---

## Preamble (run first)

```bash
STEEZ_HOME="$HOME/.steez"
STEEZ_BIN="$HOME/.claude/skills/steez/bin"
mkdir -p "$STEEZ_HOME/sessions"
touch "$STEEZ_HOME/sessions/$PPID"
find "$STEEZ_HOME/sessions" -mmin +120 -type f -delete 2>/dev/null || true
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
_PROACTIVE=$("$STEEZ_BIN/steez-config" get proactive 2>/dev/null || echo "true")
echo "PROACTIVE: $_PROACTIVE"
REPO_MODE=solo
echo "REPO_MODE: $REPO_MODE"
mkdir -p "$STEEZ_HOME/analytics"
echo '{"skill":"steez-setup-browser-cookies","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> "$STEEZ_HOME/analytics/skill-usage.jsonl" 2>/dev/null || true
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
```

## Beads Context

```bash
"$HOME/.claude/skills/steez/bin/steez-bd" resume 2>/dev/null || true
```

If `PROACTIVE` is `"false"`, do not proactively suggest steez skills AND do not
auto-invoke skills based on conversation context. Only run skills the user explicitly
types. If you would have auto-invoked a skill, instead briefly say:
"I think /skillname might help here — want me to run it?" and wait for confirmation.

## Voice

**Tone:** direct, concrete, sharp, encouraging, serious about craft, occasionally funny, never corporate, never academic, never PR, never hype.

## Skill Self-Report

If you encounter a bug in THIS skill's instructions, create a report:
```bash
mkdir -p "$STEEZ_HOME/skill-reports"
echo "## Bug Report: steez-setup-browser-cookies ($(date -u +%Y-%m-%dT%H:%M:%SZ))

**What went wrong:** <describe the issue>
**Expected behavior:** <what should have happened>
**Actual behavior:** <what actually happened>
**Suggested fix:** <how the SKILL.md should be changed>
" >> "$STEEZ_HOME/skill-reports/steez-setup-browser-cookies.md"
```

# Setup Browser Cookies

Import logged-in sessions from your real Chromium browser into the headless browse session.

## SETUP (run this check BEFORE any browse command)

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
B=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/.claude/skills/steez/browse/dist/browse" ] && B="$_ROOT/.claude/skills/steez/browse/dist/browse"
[ -z "$B" ] && B=~/.claude/skills/steez/browse/dist/browse
if [ -x "$B" ]; then
  echo "READY: $B"
else
  echo "NEEDS_SETUP"
fi
```

If `NEEDS_SETUP`:
1. Tell the user: "steez-browse needs a one-time build (~10 seconds). OK to proceed?" Then STOP and wait.
2. Run: `cd ~/.claude/skills/steez/browse && bun install && bun run build`
3. If `bun` is not installed:
   ```bash
   if ! command -v bun >/dev/null 2>&1; then
     BUN_VERSION="1.3.10"
     BUN_INSTALL_SHA="bab8acfb046aac8c72407bdcce903957665d655d7acaa3e11c7c4616beae68dd"
     tmpfile=$(mktemp)
     curl -fsSL "https://bun.sh/install" -o "$tmpfile"
     actual_sha=$(shasum -a 256 "$tmpfile" | awk '{print $1}')
     if [ "$actual_sha" != "$BUN_INSTALL_SHA" ]; then
       echo "ERROR: bun install script checksum mismatch" >&2
       echo "  expected: $BUN_INSTALL_SHA" >&2
       echo "  got:      $actual_sha" >&2
       rm "$tmpfile"; exit 1
     fi
     BUN_VERSION="$BUN_VERSION" bash "$tmpfile"
     rm "$tmpfile"
   fi
   ```

## CDP mode check

First, check if browse is already connected to the user's real browser:
```bash
$B status 2>/dev/null | grep -q "Mode: cdp" && echo "CDP_MODE=true" || echo "CDP_MODE=false"
```
If `CDP_MODE=true`: tell the user "Not needed -- you're connected to your real browser via CDP. Your cookies and sessions are already available." and stop. No cookie import needed.

## How it works

1. Find the browse binary
2. Run `cookie-import-browser` to detect installed browsers and open the picker UI
3. User selects which cookie domains to import in their browser
4. Cookies are decrypted and loaded into the Playwright session

## Steps

### 1. Find the browse binary

Use the SETUP section above to locate `$B`.

### 2. Open the cookie picker

```bash
$B cookie-import-browser
```

This auto-detects installed Chromium browsers (Comet, Chrome, Arc, Brave, Edge) and opens
an interactive picker UI in your default browser where you can:
- Switch between installed browsers
- Search domains
- Click "+" to import a domain's cookies
- Click trash to remove imported cookies

Tell the user: **"Cookie picker opened -- select the domains you want to import in your browser, then tell me when you're done."**

### 3. Direct import (alternative)

If the user specifies a domain directly (e.g., `/steez-setup-browser-cookies github.com`), skip the UI:

```bash
$B cookie-import-browser comet --domain github.com
```

Replace `comet` with the appropriate browser if specified.

### 4. Verify

After the user confirms they're done:

```bash
$B cookies
```

Show the user a summary of imported cookies (domain counts).

## Notes

- On macOS, the first import per browser may trigger a Keychain dialog -- click "Allow" / "Always Allow"
- On Linux, `v11` cookies may require `secret-tool`/libsecret access; `v10` cookies use Chromium's standard fallback key
- Cookie picker is served on the same port as the browse server (no extra process)
- Only domain names and cookie counts are shown in the UI -- no cookie values are exposed
- The browse session persists cookies between commands, so imported cookies work immediately
