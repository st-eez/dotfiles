---
description: Multi-agent validation for loop changes. Runs 4 specialized agents to find issues, scores them independently, and categorizes as blocking or discovered.
user_invocable: true
---

# Loop Validate

Validate the current git changes using a multi-agent approach.

To do this, follow these steps precisely:

1. Use a Haiku agent to give you a list of file paths to (but not the contents of) any relevant CLAUDE.md files from the codebase: the root CLAUDE.md file (if one exists), as well as any CLAUDE.md files in the directories whose files the git diff modified

2. Use a Haiku agent to view the git diff, and ask the agent to return a summary of the change

3. Then, launch 4 parallel Sonnet agents to independently review the change. The agents should do the following, then return a list of issues and the reason each issue was flagged (eg. CLAUDE.md adherence, bug, historical git context, etc.):
   a. Agent #1: Audit the changes to make sure they comply with the CLAUDE.md. Note that CLAUDE.md is guidance for Claude as it writes code, so not all instructions will be applicable during code review.
   b. Agent #2: Read the file changes in the git diff, then do a shallow scan for obvious bugs. Avoid reading extra context beyond the changes, focusing just on the changes themselves. Focus on large bugs, and avoid small issues and nitpicks. Ignore likely false positives.
   c. Agent #3: Read the git blame and history of the code modified, to identify any bugs in light of that historical context
   d. Agent #4: Read code comments in the modified files, and make sure the changes in the git diff comply with any guidance in the comments.

4. For each issue found in #3, launch a parallel Haiku agent that takes the git diff, issue description, and list of CLAUDE.md files (from step 1), and returns a score to indicate the agent's level of confidence for whether the issue is real or false positive. To do that, the agent should score each issue on a scale from 0-100, indicating its level of confidence. For issues that were flagged due to CLAUDE.md instructions, the agent should double check that the CLAUDE.md actually calls out that issue specifically. The scale is (give this rubric to the agent verbatim):
   a. 0: Not confident at all. This is a false positive that doesn't stand up to light scrutiny, or is a pre-existing issue.
   b. 25: Somewhat confident. This might be a real issue, but may also be a false positive. The agent wasn't able to verify that it's a real issue. If the issue is stylistic, it is one that was not explicitly called out in the relevant CLAUDE.md.
   c. 50: Moderately confident. The agent was able to verify this is a real issue, but it might be a nitpick or not happen very often in practice. Relative to the rest of the changes, it's not very important.
   d. 75: Highly confident. The agent double checked the issue, and verified that it is very likely it is a real issue that will be hit in practice. The existing approach is insufficient. The issue is very important and will directly impact the code's functionality, or it is an issue that is directly mentioned in the relevant CLAUDE.md.
   e. 100: Absolutely certain. The agent double checked the issue, and confirmed that it is definitely a real issue, that will happen frequently in practice. The evidence directly confirms this.

5. Filter out any issues with a score less than 80.

6. Categorize remaining issues by checking each issue's file and line number against the git diff:
   - **BLOCKING**: Issue is on a line that was MODIFIED in the git diff (added or changed lines). These must be fixed before commit.
   - **DISCOVERED**: Issue is on a line that was NOT modified in the git diff (pre-existing code that the review happened to catch). These should be appended to the plan for later.

7. Return results in this format:

---

## Validation Results

### BLOCKING ISSUES (must fix before commit)

1. `[file]:[line]` - [description] (confidence: [score])

   [brief explanation of why this is a problem and how to fix it]

2. ...

### DISCOVERED ISSUES (append to plan)

1. `[file]:[line]` - [description] (confidence: [score])

   [brief explanation - this is pre-existing, not from current changes]

2. ...

### Summary

- **X blocking issues** - must fix before commit
- **Y discovered issues** - append to plan as unrelated items

---

Or, if no issues found:

---

## Validation Results

No issues found (confidence >= 80). Validation passed.

**NEXT STEP:** Run tests (STEP 4). Do not stop here.

Checked for: CLAUDE.md compliance, bugs, git history context, code comment compliance.

---

Examples of false positives, for steps 3 and 4:

- Pre-existing issues (these become DISCOVERED, not false positives, if confidence >= 80)
- Something that looks like a bug but is not actually a bug
- Pedantic nitpicks that a senior engineer wouldn't call out
- Issues that a linter, typechecker, or compiler would catch (eg. missing or incorrect imports, type errors, broken tests, formatting issues, pedantic style issues like newlines). No need to run these build steps yourself -- it is safe to assume that they will be run separately as part of CI.
- Issues that are called out in CLAUDE.md, but explicitly silenced in the code (eg. due to a lint ignore comment)
- Changes in functionality that are likely intentional or are directly related to the broader change

Notes:

- Do not check build signal or attempt to build or typecheck the app. These will run separately, and are not relevant to validation.
- **DO NOT use TodoWrite** - this skill runs within the main loop workflow which has its own todo list. Using TodoWrite here would overwrite the caller's progress tracking.
- You must cite file paths and line numbers for each issue
- Use `git diff` to see changes
- Use `git blame` and `git log` for history context

