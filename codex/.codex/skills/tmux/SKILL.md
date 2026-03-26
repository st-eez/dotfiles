---
name: tmux
description: "REQUIRED when running any tmux command — contains critical safety rules and correct syntax that prevent common mistakes like sending commands to the wrong pane. Use this skill whenever the user mentions tmux, panes, windows, sessions, or asks to read/send to another pane. Also trigger when the user says things like 'read the other pane', 'what's running in my other window', 'send this to the other pane', 'split the window', 'check that pane', or any variation of interacting with tmux. Even if you think you know tmux, this skill contains project-specific guardrails you must follow."
---

# Tmux Operations

Use tmux from the command line to inspect panes, send input, and capture output. Prefer explicit pane targets and verify the target before sending text.

## Rules

1. Identify the pane running your shell by matching `$TMUX_PANE` against `tmux list-panes -a -F ...`. Do not use `tmux display-message -p` to identify yourself because it reports the focused pane, not necessarily the pane running your process.
2. Before `send-keys`, inspect `#{pane_current_command}` for the target pane. A shell such as `zsh` or `bash` accepts commands; a TUI such as `vim`, `node`, or `python` may treat the text as raw keystrokes.
3. For chat-like panes, use the delayed one-command submission pattern shown below. Do not use a single `send-keys` invocation that includes both the text and `Enter`.
4. Use `capture-pane -p` when reading output. Without `-p`, tmux writes to an internal paste buffer instead of stdout.
5. Prefer explicit `session:window.pane` targets for any operation that affects another pane or window.
6. Never put literal `\n` sequences inside the `send-keys` text payload. tmux sends them as the characters `\` and `n`, not as real line breaks.
7. If the target pane is an interactive app or chat-like composer rather than a shell prompt, verify after every send that the text was submitted and is not still sitting in the input box.
8. After `split-window`, use `list-panes` to confirm the new pane index — indices renumber when a pane is inserted between existing ones.

## Target Format

All tmux targets use `-t session:window.pane`.

- `session`: tmux session name such as `work`
- `window`: window index such as `1`
- `pane`: pane index within the window such as `2`

Example:

```sh
tmux capture-pane -t work:1.2 -p
```

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

**Before any `send-keys`, verify your target is correct:**

1. Run the `SELF` command above to know which pane is yours
2. Confirm the target pane index differs from your own
3. Check `#{pane_current_command}` on the target to verify it is the pane you expect

Do not skip this. Sending text to your own pane or the wrong agent session is the most common tmux failure mode.

## Sending Input

Check what is running in the target pane first:

```sh
tmux display-message -t work:1.2 -p '#{pane_current_command}'
```

Safe shells usually report `zsh` or `bash`. Interactive programs or chat-like agent UIs require extra caution.

When the target pane is a chat/composer UI, use this as the default submission pattern:

```sh
tmux send-keys -t work:1.2 "your message here" \; run-shell -d 0.3 'tmux send-keys -t work:1.2 Enter'
sleep 1
tmux capture-pane -t work:1.2 -p | tail -10
```

Assume these failure modes unless you verify otherwise:

- literal `\n` is inserted as backslash + n
- sending text plus `Enter` in one `send-keys` invocation leaves the prompt sitting in the input box
- submission is not complete until a second tmux action sends `Enter`

Do not rely on combining the command text and `Enter` in a single `send-keys` call. During testing, `Enter`, `C-m`, `KPEnter`, and `C-j` in the same `send-keys` invocation all left the prompt in the composer.

If the prompt is still visible in the composer after the delayed command, send `Enter` again and re-check.

For multiline text, send actual newlines rather than escaped `\n` sequences. For chat-like panes, keep using the delayed one-command pattern:

```sh
tmux send-keys -t work:1.2 "$(cat <<'EOF'
first line
second line
EOF
)" \; run-shell -d 0.3 'tmux send-keys -t work:1.2 Enter'
```

This does **not** work:

```sh
tmux send-keys -t work:1.2 "first line\nsecond line"
```

For chat-like panes, prefer a short message or a file reference over a large multiline paste unless you have already verified that the target UI handles pasted newlines correctly.

## Reading Scrollback

```sh
tmux capture-pane -t work:1.2 -p -S -200
tmux capture-pane -t work:1.2 -p -S -200 | tail -30
```

For long-running commands or evaluations, increase `-S` and `tail` values as needed.

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
tmux send-keys -t "work:1.$NEW_PANE" "pytest tests/" \; run-shell -d 0.3 "tmux send-keys -t work:1.$NEW_PANE Enter"
tmux capture-pane -t "work:1.$NEW_PANE" -p -S -200
```

Stop a process, then start a replacement command:

```sh
tmux send-keys -t work:1.2 C-c
sleep 1
tmux send-keys -t work:1.2 "npm run dev" \; run-shell -d 0.3 'tmux send-keys -t work:1.2 Enter'
```
