---
name: claude-spawn
description: "Spawn a Claude Code instance in a new tmux pane, window, or session. Use this skill whenever the user wants to spawn, launch, or orchestrate another Claude agent, start an autonomous Claude session, or send Claude to work in a worktree or directory. Also trigger when the user says things like 'spawn claude', 'launch an agent', 'start claude in a new pane', 'send claude to work on X', or 'spin up another claude'."
---

# Claude Spawn — Tmux-based Claude Code Orchestrator

Spawn a new Claude Code instance in a tmux target. This skill is project-agnostic.

## Step 1 — Gather spawn parameters

Use AskUserQuestion to collect the spawn configuration. Ask all questions in a single call:

**Question 1 — Tmux target:**
- question: "Where should the new Claude instance run?"
- header: "Tmux target"
- options:
  - "New window (Recommended)" — Clean tab in the current session. Easy to switch to and monitor.
  - "Split horizontal" — Side-by-side with current pane (split-h).
  - "Split vertical" — Stacked above/below current pane (split-v).
  - "New session" — Fully isolated tmux session.

**Question 2 — Working directory:**
- question: "What directory should the new Claude instance work in?"
- header: "Directory"
- options:
  - "Current directory" — Use the same working directory as this session.
  - "A worktree" — Specify a git worktree path.
  - "Custom path" — Specify any directory path.

**Question 3 — Initial prompt:**
- question: "Should the spawned Claude receive an initial prompt?"
- header: "Prompt"
- options:
  - "Yes, I'll provide one" — You'll be asked for the prompt text next.
  - "No, just open Claude" — Launch Claude with no initial task.

## Step 2 — Collect follow-up inputs

Based on answers from Step 1:

- If "A worktree" was selected: Ask for the worktree name or path.
- If "Custom path" was selected: Ask for the directory path.
- If "Yes, I'll provide one" was selected: Ask for the prompt text.
- If "New session" was selected: Ask for the session name (suggest a default like `agent-1`).

Use AskUserQuestion for any follow-up. Combine multiple follow-ups into a single call when possible.

## Step 3 — Validate and resolve

Before spawning, validate the inputs:

1. **Confirm tmux is running**: Run `echo $TMUX` — if empty, tell the user they need to be in a tmux session and stop.
2. **Resolve directory**: Verify the target directory exists with `test -d <path>`.
3. **Identify self**: Find which pane you're running in so you don't accidentally target it:
   ```bash
   SELF_PANE=$(tmux list-panes -a -F "#{pane_id} #{session_name}:#{window_index}.#{pane_index}" | grep "^$TMUX_PANE " | awk '{print $2}')
   ```
4. **Get current session**: Extract the session name for targeting:
   ```bash
   CURRENT_SESSION=$(echo "$SELF_PANE" | cut -d: -f1)
   ```

## Step 4 — Spawn the Claude instance

Execute the tmux commands based on the user's choices. Follow these rules strictly:

### Tmux operation rules
- Always send text and Enter as **separate** `send-keys` calls.
- After creating a new pane/window, use `list-panes` to confirm the new pane index.
- Use explicit `session:window.pane` targets for all operations.

### Spawn sequence

**4a. Create the tmux target:**

For **new window** (default):
```bash
tmux new-window -t "$CURRENT_SESSION"
NEW_TARGET=$(tmux display-message -t "$CURRENT_SESSION" -p "#{session_name}:#{window_index}.#{pane_index}")
```

For **split horizontal**:
```bash
tmux split-window -t "$SELF_PANE" -h
NEW_TARGET=$(tmux list-panes -t "$CURRENT_SESSION" -F "#{session_name}:#{window_index}.#{pane_index}" | tail -1)
```

For **split vertical**:
```bash
tmux split-window -t "$SELF_PANE" -v
NEW_TARGET=$(tmux list-panes -t "$CURRENT_SESSION" -F "#{session_name}:#{window_index}.#{pane_index}" | tail -1)
```

For **new session**:
```bash
tmux new-session -d -s "<session-name>"
NEW_TARGET="<session-name>:0.0"
```

**4b. Change to the working directory:**
```bash
tmux send-keys -t "$NEW_TARGET" "cd <directory>"
tmux send-keys -t "$NEW_TARGET" Enter
```

**4c. Launch Claude Code (interactive session):**

IMPORTANT: Always launch Claude as an interactive session — never use `-p` flag, which runs headless and exits after one response.

```bash
tmux send-keys -t "$NEW_TARGET" "claude --dangerously-skip-permissions"
tmux send-keys -t "$NEW_TARGET" Enter
```

**4d. Wait for Claude to be ready, then send initial prompt (if provided):**

Poll until Claude's input prompt is visible before sending anything:
```bash
for i in $(seq 1 15); do
  if tmux capture-pane -t "$NEW_TARGET" -p | grep -q '❯'; then
    echo "Claude is ready"
    break
  fi
  sleep 1
done
```

If the user provided an initial prompt, send it via `send-keys` into the running interactive session:
```bash
tmux send-keys -t "$NEW_TARGET" "<prompt text>"
tmux send-keys -t "$NEW_TARGET" Enter
```

For multi-line or complex prompts, send line by line or use literal newlines. Do NOT use `-p` flag.

**4e. Verify launch:**
```bash
tmux capture-pane -t "$NEW_TARGET" -p | tail -10
```

## Step 5 — Report to the user

After spawning, report:
- The tmux target address (e.g., `work:2.0`)
- The working directory
- Whether an initial prompt was sent
- How to check on it: `tmux capture-pane -t <target> -p | tail -20`
- How to switch to it: `tmux select-window -t <target>` or `tmux switch-client -t <target>`

## Step 6 — Offer monitoring loop

After reporting, ask the user if they want to set up a periodic monitoring loop for the spawned agent(s).

Use AskUserQuestion:
- question: "Want to set up a /loop to periodically check on the spawned agent?"
- header: "Monitor"
- options:
  - "Yes, every 5 minutes (Recommended)" — Runs /loop to capture-pane the agent target every 5 minutes and report status.
  - "Yes, custom interval" — You'll be asked for the interval.
  - "No, I'll check manually" — Skip monitoring.

If the user says yes, invoke the `/loop` skill with a command that:
1. Captures the last 30 lines of the agent's pane via `tmux capture-pane -t <target> -p -S -30`
2. Checks if the agent is idle (look for the `❯` prompt with no activity) or actively working
3. Reports a brief status summary: working, idle, errored, or finished
