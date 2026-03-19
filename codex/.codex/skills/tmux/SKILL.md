---
name: tmux
description: "REQUIRED when running any tmux command — contains critical safety rules and correct syntax that prevent common mistakes like sending commands to the wrong pane. Use this skill whenever the user mentions tmux, panes, windows, sessions, or asks to read/send to another pane. Also trigger when the user says things like 'read the other pane', 'what's running in my other window', 'send this to the other pane', 'split the window', 'check that pane', or any variation of interacting with tmux. Even if you think you know tmux, this skill contains project-specific guardrails you must follow."
---

# Tmux Operations

Use tmux from the command line to inspect panes, send input, and capture output. Prefer explicit pane targets and verify the target before sending text.

## Rules

1. Identify the pane running your shell by matching `$TMUX_PANE` against `tmux list-panes -a -F ...`. Do not use `tmux display-message -p` to identify yourself because it reports the focused pane, not necessarily the pane running your process.
2. Before `send-keys`, inspect `#{pane_current_command}` for the target pane. A shell such as `zsh` or `bash` accepts commands; a TUI such as `vim`, `node`, or `python` may treat the text as raw keystrokes.
3. Always send the text and `Enter` as separate tmux commands.
4. Use `capture-pane -p` when reading output. Without `-p`, tmux writes to an internal paste buffer instead of stdout.
5. Prefer explicit `session:window.pane` targets for any operation that affects another pane or window.

## Target Format

All tmux targets use `-t session:window.pane`.

- `session`: tmux session name such as `work`
- `window`: window index such as `1`
- `pane`: pane index within the window such as `2`

Example:

```sh
tmux capture-pane -t work:1.2 -p
```

You can omit components from the right when needed:

- `-t work:1` targets window `1` in session `work`
- `-t work` targets the current window and pane of session `work`

## Discovering Layout

Start by finding the pane that is running your process:

```sh
SELF=$(tmux list-panes -a -F "#{pane_id} #{session_name}:#{window_index}.#{pane_index}" | grep "^$TMUX_PANE " | awk '{print $2}')
echo "I am running in: $SELF"
```

Then inspect the tmux layout:

```sh
tmux list-sessions
tmux list-windows -a
tmux list-panes -a -F "#{session_name}:#{window_index}.#{pane_index}  #{pane_current_command}  #{pane_width}x#{pane_height}"
```

Before targeting a pane, confirm it is the intended one. Accidentally sending text to your own pane or another agent session is a common failure mode.

## Sending Input

Check what is running in the target pane first:

```sh
tmux display-message -t work:1.2 -p '#{pane_current_command}'
```

Safe shells usually report `zsh` or `bash`. Interactive programs such as `node`, `vim`, `python`, or another coding agent require extra caution.

**Every time you send text to a pane, follow all 3 steps:**

1. `send-keys` with the text (no Enter)
2. `send-keys` with `Enter` (separate call — if combined, Enter gets swallowed as a literal newline)
3. `capture-pane` to verify the text was accepted and the target is working

```sh
# Step 1 — send the text
tmux send-keys -t work:1.2 "npm run dev"
# Step 2 — send Enter separately
tmux send-keys -t work:1.2 Enter
# Step 3 — verify it was submitted
sleep 1
tmux capture-pane -t work:1.2 -p | tail -5
# If your text is still sitting in the input line, Enter was not sent — resend it
```

Never combine the command text and `Enter` in a single `send-keys` call.

Special keys:

- `Enter`
- `Escape`
- `Tab`
- `C-c`
- `C-d`
- `Up`
- `Down`
- `Left`
- `Right`

To interrupt a running command:

```sh
tmux send-keys -t work:1.2 C-c
```

## Reading Output

Capture visible output:

```sh
tmux capture-pane -t work:1.2 -p
```

Capture recent scrollback:

```sh
tmux capture-pane -t work:1.2 -p -S -200
tmux capture-pane -t work:1.2 -p -S -200 | tail -30
```

## Checking What Is Running

```sh
tmux display-message -t work:1.2 -p '#{pane_current_command}'
```

This reports the foreground command for the pane. A shell name usually means the pane is idle at a prompt.

## Waiting For A Command To Finish

tmux has no built-in wait. Poll the pane command until it returns to the shell:

```sh
while [ "$(tmux display-message -t work:1.2 -p '#{pane_current_command}')" != "zsh" ]; do
  sleep 2
done
echo "Command finished"
```

Adjust the shell name if the pane uses `bash` or another shell.

## Creating Panes And Windows

```sh
tmux split-window -t work:1 -v
tmux split-window -t work:1 -h
tmux new-window -t work
tmux new-window -t work -n "servers"
```

After splitting, the new pane becomes active. Use `list-panes` to confirm its index.

## Resizing Panes

```sh
tmux resize-pane -t work:1.2 -D 10
tmux resize-pane -t work:1.2 -R 20
```

Available directions: `-U`, `-D`, `-L`, `-R`.

## Common Patterns

Run a command in a new pane and capture its output later:

```sh
tmux split-window -t work:1 -v
NEW_PANE=$(tmux list-panes -t work:1 -F "#{pane_index}" | tail -1)
tmux send-keys -t "work:1.$NEW_PANE" "pytest tests/"
tmux send-keys -t "work:1.$NEW_PANE" Enter
tmux capture-pane -t "work:1.$NEW_PANE" -p -S -200
```

Stop a process, then start a replacement command:

```sh
tmux send-keys -t work:1.2 C-c
sleep 1
tmux send-keys -t work:1.2 "npm run dev"
tmux send-keys -t work:1.2 Enter
```
