#!/bin/bash

# Loop-setup UserPromptSubmit Hook
# Creates state file on first prompt when loop workflow is active
# State file pattern provides explicit state management vs fragile transcript parsing

set -euo pipefail

STATE_FILE=".claude/loop-setup.local.md"

# Log function for debugging (writes to stderr)
log() {
    echo "[user-prompt-submit] $1" >&2
}

# Read hook input from stdin (do this first to get session_id for stale check)
INPUT=$(cat)

# Extract session identifiers from hook input
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')

# 1. Check for existing state file
if [[ -f "$STATE_FILE" ]]; then
    # Check if it's from the current session or stale from a crashed session
    STORED_SESSION_ID=$(grep -E '^session_id:' "$STATE_FILE" 2>/dev/null | sed 's/session_id: *//' | tr -d '"' | tr -d ' ' || echo "")

    if [[ -n "$STORED_SESSION_ID" ]] && [[ -n "$SESSION_ID" ]] && [[ "$STORED_SESSION_ID" == "$SESSION_ID" ]]; then
        # Same session - state file is valid, skip
        log "State file exists for current session, skipping"
        exit 0
    elif [[ -n "$STORED_SESSION_ID" ]] && [[ -n "$SESSION_ID" ]]; then
        # Different session - stale state file from crashed session
        log "Stale state file detected (stored: $STORED_SESSION_ID, current: $SESSION_ID), will replace"
        rm -f "$STATE_FILE"
    else
        # Can't determine (missing session_id), skip to be safe
        log "State file exists but can't verify session, skipping"
        exit 0
    fi
fi

# 2. Check if this is the first prompt (no assistant messages yet)

if [[ -n "$TRANSCRIPT_PATH" ]] && [[ -f "$TRANSCRIPT_PATH" ]]; then
    # Check for any assistant messages in transcript
    ASSISTANT_COUNT=$(jq -r 'select(.type == "assistant") | .type' "$TRANSCRIPT_PATH" 2>/dev/null | wc -l | tr -d ' ')

    if [[ "$ASSISTANT_COUNT" -gt 0 ]]; then
        log "Not first prompt (found $ASSISTANT_COUNT assistant messages), skipping"
        exit 0
    fi
fi

# 3. Check if prompt.md exists and has the loop-setup marker
if [[ ! -f "prompt.md" ]]; then
    log "No prompt.md found, skipping"
    exit 0
fi

if ! grep -q '<!-- loop-setup:active -->' prompt.md 2>/dev/null; then
    log "prompt.md exists but lacks loop-setup:active marker, skipping"
    exit 0
fi

# 4. Create state file - this is a loop-setup workflow!
log "First prompt with loop-setup marker detected, creating state file"

# Ensure .claude directory exists
mkdir -p .claude

# Get current timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Create state file with YAML frontmatter
# Include session_id so stop-hook can detect stale state files from crashed sessions
cat > "$STATE_FILE" << EOF
---
active: true
session_id: "$SESSION_ID"
iteration: 1
completion_promise: "COMMITTED"
created_at: "$TIMESTAMP"
blocked_count: 0
---

# Loop-Setup State

This file tracks an active loop-setup workflow session.
It will be automatically deleted when the workflow completes
(when Claude outputs \`<promise>COMMITTED</promise>\`).

Do not delete this file manually while the loop is running.
EOF

log "Created state file at $STATE_FILE"
exit 0
