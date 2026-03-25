---
name: investigate
description: "Systematic root cause investigation for any kind of problem — code bugs, system issues, resource leaks, config drift, performance, network failures. Use this skill whenever the user says 'investigate', 'debug', 'figure out why', 'what's causing this', 'root cause', 'troubleshoot', 'why is this broken', 'why is this slow', 'what's wrong with', or 'what's leaking'. Also proactively suggest when the user reports errors, crashes, degraded performance, resource exhaustion, or mysterious symptoms — even if they don't explicitly say 'investigate'."
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
  - WebSearch
  - WebFetch
---

# Systematic Investigation

## Iron Law

**No fixes without root cause.**

Fixing symptoms creates whack-a-mole debugging. Every fix that skips root
cause makes the next problem harder to find. The temptation to "just restart
it" or "just kill the processes" is strong — resist it until you understand
*why*. Find the cause, then fix it.

---

## Phase 1: Gather Evidence

Collect evidence before forming any hypothesis. The natural urge is to jump
to a theory — fight it. Premature hypotheses create confirmation bias.

### 1. Collect symptoms

What exactly is happening? Error messages, observable behavior, timing,
frequency. Get specific — "it's slow" is not a symptom; "API responses take
12s instead of 200ms since Tuesday" is.

If the user hasn't provided enough context, ask **one focused question**.
Don't overwhelm with a list of five questions.

### 2. Trace causality

Follow evidence backward from the symptom toward potential causes. Start
at the symptom and work backward through the chain of "what produced this?"

### 3. Check what changed

Most problems are caused by something that changed. Find it.

Every domain has its own "change history" — git log for code, system logs
for infrastructure, config diffs for configuration.

### 4. Check upstream sources

Do not assume you know how something is supposed to work — verify it.
Read official documentation for the affected tool, library, or framework.
Search GitHub issues for the symptom; someone may have already reported it.
Check recent releases and changelogs; behavior may have changed intentionally.
Look for open PRs — a fix may already exist.

This step exists because a common failure mode is confidently "fixing"
intended behavior, or reinventing a solution that's already been shipped
upstream. Docs first, hypothesis second. That said, upstream sources
calibrate your expectations — they do not override local evidence,
reproduction results, or first-principles reasoning.

### 5. Reproduce

Can you trigger the problem on demand? If yes, you have a feedback loop for
testing hypotheses. If no, gather more evidence before proceeding — guessing
without reproduction is expensive.

### 6. Check local history

Has this area broken before? Check prior fixes, earlier workarounds, git
history, past incidents, and previous configuration changes in the same
component or system. Repeat failures in the same place are an architectural
smell, not bad luck.

For accumulation, leak, or orphaned-state problems: identify both sides of
the lifecycle — what creates the resource and what is supposed to release or
clean it up. A root cause is incomplete if you know how something starts but
not why it persists.

**Output:** A specific, testable claim:
*"Root cause hypothesis: [X] is happening because [Y], caused by [Z]."*

---

## Phase 2: Hypothesize & Test

Before taking ANY corrective action, verify your hypothesis.

### Test it
Add instrumentation at the suspected root cause — a log line, a debug
command, a monitoring check. Run the reproduction. Does the evidence match?

Distinguish what you observed from what you inferred. If a cause or
contributing factor was not directly confirmed by logs, live observation, or
reproduction, label it as a likely mechanism or inference — not established
fact.

### If wrong
Don't guess harder. Return to Phase 1 and gather more evidence. Each failed
hypothesis is data — it tells you where the problem *isn't*.

### 3-Strike Rule
If 3 hypotheses fail, **stop**. Ask the user:

> Three hypotheses tested, none confirmed. This may be deeper than a
> surface-level issue.
>
> A) Continue — I have a new angle: [describe]
> B) Widen scope — instrument and monitor
> C) Escalate — this needs deeper system knowledge

### Red flags — slow down if you catch yourself:
- Proposing a fix before tracing the full causal chain — you're guessing
- "Quick fix for now" — there is no "for now." Fix it or escalate.
- Each fix reveals a new problem elsewhere — wrong layer, not wrong code

---

## Phase 3: Fix

Once — and only once — root cause is confirmed:

### 1. Address the root cause, not the symptom
The smallest intervention that eliminates the actual problem. Restarting a
service is a band-aid. Killing leaked processes is a band-aid. Fix *why*.

Before recommending any mitigation, be explicit about whether it fixes root
cause or only reduces symptoms, and whether it applies to the current
session, the current workspace, or the whole system.

### 2. Minimal blast radius
Fewest changes, narrowest scope. If the fix touches many things, pause and
verify you're at the right layer.

### 3. Verify the fix
Prove the fix works under the same conditions that triggered the failure.
For code investigations: write a regression test that fails without the fix
and passes with it, then run the relevant test suite to confirm no
regressions.

### 4. Prevent recurrence
Ask: *"What would prevent this from happening again?"* Sometimes the answer
is a test, sometimes a monitoring alert, sometimes fixing a cleanup path,
sometimes documentation. Do the thing that makes this class of problem less
likely.

---

## Phase 4: Report

Output a structured report:

```
INVESTIGATION REPORT
════════════════════════════════════════
Symptom:      [what was observed]
Domain:       [code | system | config | network | performance]
Root cause:   [what was actually wrong and why]
Evidence:     [how the root cause was confirmed]
Fix:          [what was changed]
Verification: [how the fix was verified]
Prevention:   [what prevents recurrence]
Status:       RESOLVED | RESOLVED_WITH_CONCERNS | NEEDS_CONTEXT | UNRESOLVED
════════════════════════════════════════
```

Status meanings:
- **RESOLVED** — root cause found, fix applied and verified
- **RESOLVED_WITH_CONCERNS** — fixed but can't fully verify (intermittent, needs monitoring)
- **NEEDS_CONTEXT** — investigation blocked on information only the user can provide
- **UNRESOLVED** — root cause unclear after investigation. State what blocked
  progress, what was tried and ruled out, and the recommended next step

---

## Rules

- **3+ failed hypotheses → stop and reassess.** Wrong layer, not wrong guess.
- **Never apply a fix you can't verify.** If you can't confirm, don't ship it.
- **Never say "this should fix it."** Prove it.
- **Large blast radius → confirm with user** before proceeding.
- **It's OK to say "I don't know yet."** Bad fixes are worse than no fix.
