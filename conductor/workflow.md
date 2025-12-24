# Project Workflow

## Guiding Principles

1. **The Plan is the Source of Truth:** All work must be tracked in `plan.md`
2. **The Tech Stack is Deliberate:** Changes to the tech stack must be documented in `tech-stack.md` *before* implementation
3. **Verification First:** Ensure every change is verified via automated tests or manual "Dry Run" protocols.
4. **Clean Commits:** Commit logic should be clean and grouped by Phase to maintain a readable project history.
5. **User Experience First:** Every decision should prioritize user experience.
6. **Non-Interactive & CI-Aware:** Prefer non-interactive commands. Use `CI=true` for watch-mode tools (tests, linters) to ensure single execution.

## Task Workflow

All tasks follow a strict lifecycle:

### Standard Task Workflow

1. **Select Task:** Choose the next available task from `plan.md` in sequential order.

2. **Mark In Progress:** Before beginning work, edit `plan.md` and change the task from `[ ]` to `[~]`.

3. **Implementation:**
   - Write the minimum amount of application code necessary to complete the task.
   - Adhere to the project's code style guidelines.

4. **Verify Implementation:**
   - For logic changes, run relevant automated tests.
   - For installer changes, perform a "Dry Run" or manual verification as specified in the phase protocol.

5. **Document Deviations:** If implementation differs from tech stack:
   - **STOP** implementation.
   - Update `tech-stack.md` with new design.
   - Add dated note explaining the change.
   - Resume implementation.

6. **Mark Task Complete:**
   - Update `plan.md`, find the line for the completed task, and change its status from `[~]` to `[x]`.

7. **Commit Phase Changes (Grouped):**
   - **CRITICAL:** Changes are committed at the end of each **Phase**, not after every task.
   - Stage all code changes and plan updates related to the phase.
   - Perform the commit with a detailed message that includes the task summaries.

### Phase Completion Verification and Checkpointing Protocol

**Trigger:** This protocol is executed immediately after a task is completed that also concludes a phase in `plan.md`.

1.  **Announce Protocol Start:** Inform the user that the phase is complete and the verification and checkpointing protocol has begun.

2.  **Execute Automated Tests or Dry Runs:**
    -   Before execution, you **must** announce the exact shell command you will use.
    -   If tests fail, you **must** inform the user and begin debugging. You may attempt to propose a fix a **maximum of two times**.

3.  **Propose a Detailed, Actionable Manual Verification Plan:**
    -   Generate a step-by-step plan that walks the user through the verification process (e.g., a "Dry Run" of the installer).
    -   The plan you present to the user **must** follow this format:

        ```
        Verification steps for Phase '<Phase Name>':

        **Manual Verification Steps:**
        1.  **Execute the following command:** `./install.sh --dry-run`
        2.  **Confirm that you see:** The gum-based selection menu with Tokyo Night colors.
        3.  **Confirm that:** No files were actually modified during the dry run.
        ```

4.  **Await Explicit User Feedback:**
    -   Ask the user for confirmation: "**Does this meet your expectations? Please confirm with yes or provide feedback on what needs to be changed.**"
    -   **PAUSE** and await the user's response. Do not proceed without an explicit yes or confirmation.

5.  **Create Phase Commit:**
    -   Stage all changes (code and `plan.md`).
    -   Perform the commit with a clear and concise message: `feat(<scope>): Complete Phase <X> - <Phase Description>`.
    -   **Include Task Summaries:** The commit body should list the tasks completed in this phase.

6.  **Record Phase Checkpoint SHA:**
    -   **Step 6.1: Get Commit Hash:** Obtain the hash of the *just-created commit* (`git log -1 --format="%H"`).
    -   **Step 6.2: Update Plan:** Read `plan.md`, find the heading for the completed phase, and append the first 7 characters of the commit hash in the format `[checkpoint: <sha>]`.
    -   **Step 6.3: Write Plan:** Write the updated content back to `plan.md`.

7.  **Announce Completion:** Inform the user that the phase is complete and the checkpoint has been created.

## Definition of Done

A phase is complete when:

1. All tasks within the phase are marked `[x]` in `plan.md`.
2. Verification (Automated or Manual Dry Run) has passed.
3. Code follows project's code style guidelines.
4. Changes are committed with a proper message and body.
5. Plan is updated with the checkpoint SHA.