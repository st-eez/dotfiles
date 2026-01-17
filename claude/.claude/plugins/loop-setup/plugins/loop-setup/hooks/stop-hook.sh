#!/bin/bash

# Loop-setup Stop Hook
# Prevents premature stopping during Ralph loop workflow
# Uses state file pattern for explicit state management

set -euo pipefail

STATE_FILE=".claude/loop-setup.local.md"
MAX_BLOCKED_ATTEMPTS=5

# Log function for debugging (writes to stderr)
log() {
    echo "[stop-hook] $1" >&2
}

# Output JSON safely using jq -n
output_allow() {
    exit 0
}

output_block() {
    local reason="$1"
    local system_msg="$2"
    jq -n \
        --arg reason "$reason" \
        --arg systemMessage "$system_msg" \
        '{decision: "block", reason: $reason, systemMessage: $systemMessage}'
    exit 0
}

# 1. State file exists? No → allow stop (not in loop workflow)
if [[ ! -f "$STATE_FILE" ]]; then
    log "No state file, allowing stop"
    output_allow
fi

log "State file exists, checking workflow status"

# Read hook input from stdin
INPUT=$(cat)

# 2. Check for stale state file (from crashed session)
CURRENT_SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
STORED_SESSION_ID=$(grep -E '^session_id:' "$STATE_FILE" 2>/dev/null | sed 's/session_id: *//' | tr -d '"' | tr -d ' ' || echo "")

if [[ -n "$STORED_SESSION_ID" ]] && [[ -n "$CURRENT_SESSION_ID" ]] && [[ "$STORED_SESSION_ID" != "$CURRENT_SESSION_ID" ]]; then
    log "Stale state file detected (stored: $STORED_SESSION_ID, current: $CURRENT_SESSION_ID)"
    rm -f "$STATE_FILE"
    log "Deleted stale state file, allowing stop"
    output_allow
fi

# 3. Parse blocked_count from state file frontmatter
BLOCKED_COUNT=$(grep -E '^blocked_count:' "$STATE_FILE" 2>/dev/null | sed 's/blocked_count: *//' | tr -d ' ' || echo "0")

# Ensure BLOCKED_COUNT is a number
if ! [[ "$BLOCKED_COUNT" =~ ^[0-9]+$ ]]; then
    BLOCKED_COUNT=0
fi

log "Current blocked count: $BLOCKED_COUNT"

# 4. Check for promise in last assistant message
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')

PROMISE_FOUND=false
if [[ -n "$TRANSCRIPT_PATH" ]] && [[ -f "$TRANSCRIPT_PATH" ]]; then
    # Get last 5 assistant text outputs to check for promise
    RECENT_OUTPUTS=$(tail -200 "$TRANSCRIPT_PATH" | jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "text") | .text // empty' 2>/dev/null | tail -5 || true)

    if echo "$RECENT_OUTPUTS" | grep -q '<promise>COMMITTED</promise>'; then
        PROMISE_FOUND=true
    fi
fi

if [[ "$PROMISE_FOUND" == "true" ]]; then
    log "Promise found in output, workflow complete"
    # Clean up state file
    rm -f "$STATE_FILE"
    log "Deleted state file, allowing stop"
    output_allow
fi

# 5. Safety valve: too many blocked attempts
if [[ "$BLOCKED_COUNT" -ge "$MAX_BLOCKED_ATTEMPTS" ]]; then
    log "Safety valve triggered ($BLOCKED_COUNT >= $MAX_BLOCKED_ATTEMPTS blocked attempts)"
    # Clean up state file
    rm -f "$STATE_FILE"
    log "Deleted state file, allowing stop (safety valve)"
    output_allow
fi

# 6. Block stop - workflow incomplete
NEW_BLOCKED_COUNT=$((BLOCKED_COUNT + 1))
log "Blocking stop attempt #$NEW_BLOCKED_COUNT"

# Update blocked_count in state file
if [[ -f "$STATE_FILE" ]]; then
    sed -i '' "s/^blocked_count: *[0-9]*/blocked_count: $NEW_BLOCKED_COUNT/" "$STATE_FILE" 2>/dev/null || \
    sed -i "s/^blocked_count: *[0-9]*/blocked_count: $NEW_BLOCKED_COUNT/" "$STATE_FILE" 2>/dev/null

    # Verify update succeeded - if not, safety valve is broken
    VERIFY_COUNT=$(grep -E '^blocked_count:' "$STATE_FILE" 2>/dev/null | sed 's/blocked_count: *//' | tr -d ' ')
    if [[ "$VERIFY_COUNT" != "$NEW_BLOCKED_COUNT" ]]; then
        log "ERROR: Safety valve broken (expected $NEW_BLOCKED_COUNT, got '$VERIFY_COUNT') - allowing stop"
        rm -f "$STATE_FILE"
        output_allow
    fi
fi

output_block \
    "Workflow incomplete (attempt $NEW_BLOCKED_COUNT/$MAX_BLOCKED_ATTEMPTS). Continue to the next step. If validation passed, proceed to step 4 (ACT ON RESULTS). The loop MUST end with a commit and output <promise>COMMITTED</promise>." \
    "Loop workflow active | Complete all 7 steps, commit, and output <promise>COMMITTED</promise>"
