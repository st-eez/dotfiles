---
description: Generate a Ralph-style loop prompt for the current project
allowed-tools: Read, Grep, Glob, Bash(ls:*), Bash(cat:*), AskUserQuestion, Write
---

You are building a minimal Ralph Wiggum loop prompt (prompt.md) for this project.

## Step 1 — Ask for the specs entry point

IMPORTANT: Do NOT read any files or scan the codebase yet. Ask this question IMMEDIATELY as your very first action.

Use AskUserQuestion to ask the user:
- question: "What file should the loop study at the start of each iteration? (e.g. specs/readme.md, DESIGN.md, a plan file)"
- header: "Specs file"
- options:
  - "specs/readme.md"
  - "DESIGN.md"
  - "README.md"

Do NOT proceed to Step 2 until the user has answered.

## Step 2 — Scan the codebase

After getting the specs answer, quickly investigate:

1. **Language & framework**: Check file extensions, config files (package.json, go.mod, Cargo.toml, pyproject.toml, Makefile, etc.)
2. **Test command**: Find how tests are run (look at package.json scripts, Makefile targets, or standard commands for the detected language)
3. **Pattern anchors**: Look at the project structure and identify the dominant code patterns worth referencing (e.g. "handler patterns in internal/api/", "component patterns in src/components/", "service patterns in lib/services/"). Pick 1-2 concise anchors.

Keep scanning fast — just enough to fill the template, not a deep audit.

## Step 3 — Present the full prompt

Assemble a draft prompt.md following this exact structure (Geoffrey Huntley's Ralph prompt format):

```
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
- Keep it under 12 lines total
- Pattern anchors should reference actual directories/patterns found in the codebase
- Test type should be "property based tests or unit tests" unless the codebase clearly favors one style
- Test command should be the actual command for this project (e.g. "Run go test ./...", "Run npm test", "Run cargo test")

Present the complete draft to the user and ask if they want to adjust anything before writing it.

## Step 4 — Write prompt.md

Once the user confirms (or after incorporating their tweaks), write the final prompt to `prompt.md` in the current working directory.
