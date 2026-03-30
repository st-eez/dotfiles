---
name: steez-connect-chrome
version: 0.1.0
description: |
  Launch real Chrome controlled by Claude with the Side Panel extension auto-loaded.
  One command: connects Claude to a visible Chrome window where you can watch every
  action in real time. The extension shows a live activity feed in the Side Panel.
  Use when asked to "connect chrome", "open chrome", "real browser", "launch chrome",
  "side panel", or "control my browser". (steez)
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---

# /steez-connect-chrome -- Launch Real Chrome with Side Panel

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
echo '{"skill":"steez-connect-chrome","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> "$STEEZ_HOME/analytics/skill-usage.jsonl" 2>/dev/null || true
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
```

## Beads Context

```bash
"$HOME/.claude/skills/steez/bin/steez-bd" resume 2>/dev/null || true
```

If `PROACTIVE` is `"false"`, do not proactively suggest steez skills AND do not
auto-invoke skills based on conversation context. Only run skills the user explicitly types.

## Voice

**Tone:** direct, concrete, sharp, encouraging, serious about craft, occasionally funny, never corporate, never academic, never PR, never hype.

## Skill Self-Report

If you encounter a bug in THIS skill's instructions, create a report:
```bash
mkdir -p "$STEEZ_HOME/skill-reports"
echo "## Bug Report: steez-connect-chrome ($(date -u +%Y-%m-%dT%H:%M:%SZ))

**What went wrong:** <describe the issue>
**Expected behavior:** <what should have happened>
**Actual behavior:** <what actually happened>
**Suggested fix:** <how the SKILL.md should be changed>
" >> "$STEEZ_HOME/skill-reports/steez-connect-chrome.md"
```

---

## SETUP

Resolve the steez browse binary. This must run before any browse command.

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
1. Tell the user: "steez browse needs a one-time build (~10 seconds). OK to proceed?" Then STOP and wait.
2. Run: `cd ~/.claude/skills/steez/browse && ./setup`
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

---

## Step 0: Pre-flight Cleanup

Kill any existing headed server or orphaned Chromium processes so we start clean.

```bash
# Check for existing headed server
$B status 2>/dev/null && echo "SERVER_RUNNING" || echo "NO_SERVER"
```

If `SERVER_RUNNING` and it reports `headed` mode, ask the user:
"A headed browser is already running. Restart it? (yes/no)"

If the user says yes (or no server is running), proceed:

```bash
# Stop existing server cleanly
$B stop 2>/dev/null || true

# Kill orphaned Chromium processes holding the profile lock
PROFILE_DIR="$HOME/.steez/browse/chromium-profile"
if [ -L "$PROFILE_DIR/SingletonLock" ]; then
  LOCK_TARGET=$(readlink "$PROFILE_DIR/SingletonLock" 2>/dev/null || true)
  ORPHAN_PID=$(echo "$LOCK_TARGET" | grep -oE '[0-9]+$')
  if [ -n "$ORPHAN_PID" ] && kill -0 "$ORPHAN_PID" 2>/dev/null; then
    kill "$ORPHAN_PID" 2>/dev/null || true
    sleep 1
    kill -0 "$ORPHAN_PID" 2>/dev/null && kill -9 "$ORPHAN_PID" 2>/dev/null || true
  fi
fi

# Remove stale lock files
for LOCK in SingletonLock SingletonSocket SingletonCookie; do
  rm -f "$PROFILE_DIR/$LOCK" 2>/dev/null || true
done

echo "PRE-FLIGHT CLEAN"
```

## Step 1: Connect

Launch headed Chromium with the Side Panel extension auto-loaded.

```bash
$B connect
```

This does several things:
1. Starts the browse server in headed mode (visible Chrome window)
2. Loads the Chrome extension from `steez/extension/` (or `gstack/extension/` fallback)
3. Uses port 34567 so the extension auto-connects
4. Starts the sidebar agent process for chat relay
5. Uses `~/.steez/browse/chromium-profile/` for persistent state (cookies, cache, login sessions)

Expected output includes "Connected to real Chrome" and server status. If you see errors:
- `SingletonLock`: Step 0 cleanup didn't finish. Wait 2 seconds, retry.
- `extension not found`: The extension directory is missing. Check `~/.claude/skills/gstack/extension/manifest.json` exists.
- `EADDRINUSE`: Port 34567 is taken. Run `lsof -ti:34567 | xargs kill` then retry.

## Step 2: Verify

Confirm the connection is live and the extension loaded.

```bash
$B status
```

Check the output for:
- **Mode:** `headed` (not `headless`)
- **Port:** `34567`
- **Tabs:** at least 1

If status shows `headless`, the connect failed silently. Run `$B disconnect` then retry Step 1.

```bash
# Verify the browser is responsive
$B url
```

This should return the current page URL (typically `about:blank` or `chrome://newtab`).

## Step 3: Guide User to Side Panel

The Side Panel is where the user sees a live activity feed of everything Claude does in the browser. Guide them to open it.

Tell the user:

> Chrome is connected. You should see a Chromium window.
>
> To open the Side Panel (live activity feed):
> 1. Look for the **steez icon** in the Chrome toolbar (top-right, puzzle piece area)
> 2. Click it, then click **"Open Side Panel"**
> 3. Or: right-click the steez icon and select "Open Side Panel"
>
> The Side Panel shows every command I run in real time, plus you can send me messages through it.

If the user can't find the extension icon:
- It may be hidden in the extensions menu (puzzle piece icon)
- Click the puzzle piece, find "steez browse", and pin it
- The extension only loads in Playwright's bundled Chromium, not in regular Chrome

## Step 4: Demo

Run a quick demo so the user sees actions flowing through both the browser and the Side Panel.

```bash
$B goto https://example.com
```

Wait 2 seconds, then:

```bash
$B snapshot -i
```

Tell the user:
> You should see example.com loaded in the browser. If the Side Panel is open, you'll see the "goto" and "snapshot" commands appear in the activity feed.

Then navigate somewhere more interesting:

```bash
$B goto https://news.ycombinator.com
$B snapshot -c -d 2
```

Show the user the snapshot output so they can see how the accessibility tree maps to what's visible in the browser.

## Step 5: Sidebar Chat

The Side Panel includes a chat interface. Messages sent from the Side Panel are queued and delivered to Claude via the sidebar agent.

To check for messages from the user:

```bash
$B inbox
```

If the user sends a message through the Side Panel chat, it will appear in the inbox. You can act on it and respond through your normal output, which the activity feed will show.

Tell the user:
> You can send me messages through the Side Panel chat. I'll see them when I check my inbox. Try sending "hello" to test it.

## Step 6: What's Next

Now that Chrome is connected, suggest what the user can do:

1. **QA testing** -- Run `/steez-qa` to systematically test a web app with visual feedback
2. **Design review** -- Run `/steez-design-review` to audit visual quality in the live browser
3. **Manual browsing** -- Use `$B watch` to observe while the user browses, then `$B watch stop` for a summary
4. **Navigate anywhere** -- `$B goto <url>` works for any URL
5. **Benchmark** -- Run `/steez-benchmark` to performance-test with a visible browser

To disconnect later and return to headless mode:
```bash
$B disconnect
```

To bring the browser window to the foreground if it's behind other windows:
```bash
$B focus
```

---

## Telemetry (run last)

After the skill workflow completes (success, error, or abort), log the session.

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
echo '{"skill":"steez-connect-chrome","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","browse":"true","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$STEEZ_HOME/analytics/skill-usage.jsonl" 2>/dev/null || true
```

Replace `OUTCOME` with success/error/abort based on the workflow result.

## Completion Status Protocol

When completing this skill workflow, report status using one of:
- **DONE** -- Chrome connected, extension loaded, Side Panel available.
- **DONE_WITH_CONCERNS** -- Connected, but with issues (e.g., extension not found, Side Panel not loading).
- **BLOCKED** -- Cannot connect. State what is blocking and what was tried.
- **NEEDS_CONTEXT** -- Missing information required to continue.
