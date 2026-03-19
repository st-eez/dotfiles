---
name: loop-prompt
description: Generate a Ralph-style loop prompt for the current project. Use when the user wants to create a loop prompt, a Ralph Wiggum prompt, a `prompt.md`, or set up an automated coding loop. Trigger on requests such as "make me a loop file", "set up a prompt for looping", or "create a prompt.md".
---

# Loop Prompt

Build a minimal Ralph Wiggum loop prompt for the current project.

## Step 1

Do not read files or scan the codebase yet. Ask the user this question immediately as the first action:

```text
What file should the loop study at the start of each iteration? (for example: specs/readme.md, DESIGN.md, or README.md)
```

Do not continue until the user answers.

## Step 2

After the user provides the specs entry point, quickly inspect the codebase:

1. Detect the language and framework from file extensions and standard config files such as `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, or `Makefile`.
2. Find the correct test command for the project.
3. Identify 1-2 concise pattern anchors from the existing codebase, such as handler patterns in `internal/api/`, component patterns in `src/components/`, or service patterns in `lib/services/`.

Keep the scan shallow. Only gather enough context to fill the prompt.

## Step 3

Draft `prompt.md` in this exact structure:

```text
Study <specs-entry-point>.

Pick the most important thing to do.

Important:
- Use <pattern-anchors>.
- Build <test-type> tests, whichever is best.

After:
- <test-command>.
- When tests pass, commit and push.
```

Rules for the draft:

- Keep it under 12 lines.
- Pattern anchors must reference real directories or code patterns found in the project.
- Use `property based tests or unit tests` unless the project clearly favors one style.
- Use the actual test command for the repository, such as `Run go test ./...`, `Run npm test`, or `Run cargo test`.

Show the full draft to the user and ask whether they want any adjustments before writing the file.

## Step 4

After the user confirms, write the final prompt to `$PWD/prompt.md`.
