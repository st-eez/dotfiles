---
description: Deep codebase audit — adaptive, multi-agent analysis for any project
allowed-tools: Read, Grep, Glob, Bash, Task, AskUserQuestion, Write, Edit, TaskCreate, TaskUpdate, TaskList
---

You are conducting a thorough, adaptive codebase audit. This audit works on ANY codebase by first discovering the project's characteristics, then tailoring specialized analysis agents to match.

## Phase 0 — Discovery (YOU do this directly, do NOT delegate)

Before spawning any agents, quickly investigate:

1. **Language & framework**: Check file extensions, config files (package.json, go.mod, Cargo.toml, pyproject.toml, requirements.txt, Gemfile, composer.json, pom.xml, build.gradle, Makefile, etc.)
2. **Size**: Count source files (exclude node_modules, vendor, .git, dist, build). Categorize: small (<50 files), medium (50-300), large (300-1000), massive (1000+)
3. **Architecture style**: Identify patterns — monolith, microservices, monorepo, library, CLI tool, web app, API server, full-stack, etc.
4. **Entry points**: Find main files, route definitions, API handlers, exported modules
5. **Dependency profile**: Scan lock files or dependency manifests for known-vulnerable or outdated patterns
6. **Existing quality tooling**: Check for linters, type checkers, formatters, CI configs (.github/workflows, .gitlab-ci.yml, Jenkinsfile)
7. **Test infrastructure**: Find test directories, test runner configs, coverage settings

Output a brief **Codebase Profile** summary before proceeding. Present it to the user.

## Phase 1 — Scope & Agent Planning

Based on discovery, ask TWO questions using AskUserQuestion:

**Question 1 — Depth:**
- question: "How deep should the audit go?"
- header: "Depth"
- multiSelect: false
- options:
  - **Quick** — Entry points, auth, and data-handling hot paths only (~5 min)
  - **Standard** — All source directories, skip test/config files (~15 min) (Recommended)
  - **Deep** — Exhaustive, every source file including tests and scripts (~30+ min)

**Question 2 — Scope:**
- question: "Which audit areas should I focus on?"
- header: "Audit scope"
- multiSelect: true
- options (adapt labels/descriptions based on what's relevant to the discovered stack):
  - **Security** — injection flaws, auth issues, secrets, dependency vulnerabilities
  - **Architecture** — coupling, dependency direction, modularity, pattern consistency
  - **Error Handling & Resilience** — unhandled errors, missing timeouts, resource leaks, race conditions
  - **Code Quality & Maintainability** — dead code, duplication, complexity, tech debt markers

If the user doesn't select any scope options, default to: Security + Error Handling + Code Quality.

Pass the chosen depth to every agent so they know how much ground to cover. Quick = only files identified as high-risk in Phase 0. Standard = all source directories. Deep = everything including tests and scripts.

Wait for the user's selections before proceeding.

## Phase 2 — Parallel Specialized Agents

Launch selected agents IN PARALLEL using the Task tool with subagent_type="general-purpose". Each agent receives:
- The codebase profile from Phase 0
- A stack-specific checklist tailored to the detected language/framework
- Instructions to output structured findings

### Agent Output Format

Each agent MUST produce output in this format:

```
## [Category] Audit Report

### Critical Findings
- **[CRITICAL | confirmed]** file_path:line — Description. Fix: ...

### High Findings
- **[HIGH | confirmed]** file_path:line — Description. Fix: ...

### Medium Findings
- **[MEDIUM | suspected]** file_path:line — Description. Fix: ...

### Low Findings
- **[LOW | suspected]** file_path:line — Description. Fix: ...

### Summary
- Total findings: N (X critical, Y high, Z medium, W low)
- Confirmed: N, Suspected: N
- Top concern: ...
```

**Confidence rules:**
- **confirmed** = the agent directly observed the vulnerable/problematic pattern in the code (e.g., grep matched a dangerous call with unsanitized input flowing in)
- **suspected** = the pattern looks risky but the agent couldn't fully trace the data flow or confirm exploitability

Severity is based on: impact (what's the worst case?) x likelihood (how easy is it to trigger?). Security findings involving user input should be scored higher than internal-only code paths.

### What Each Agent Should Look For

#### Security Agent
Search the OWASP Top 10 categories adapted to the detected stack:
- Hardcoded secrets, keys, tokens, or credentials committed to the repo
- Injection vulnerabilities: SQL, command, template, and DOM injection patterns
- Unsafe deserialization of untrusted input
- Dynamic code execution from string input
- Missing or overly permissive CORS, auth, and access control
- Sensitive data exposure in logs, error messages, or responses
- Vulnerable dependencies: require advisory ID (CVE/GHSA), affected version, and fixed version. Do NOT flag vague "outdated" without a specific known vulnerability
- Missing rate limiting on public endpoints

Use your knowledge of the specific language and framework detected to search for the idiomatic vulnerability patterns of that stack. Grep for known-dangerous function calls and patterns.

#### Architecture Agent
- Circular dependencies between modules/packages
- God files (>500 lines of logic, not config/generated)
- Dependency direction violations (inner layers importing outer layers)
- Inconsistent patterns (e.g., some handlers use middleware, others don't)
- Missing abstraction boundaries (direct DB calls from route handlers)
- Configuration scattered vs. centralized
- Shared mutable state

#### Error Handling Agent
- Swallowed errors (empty catch/except/rescue blocks)
- Missing timeouts on HTTP and database calls
- Resource leaks (unclosed connections, file handles, streams)
- Race conditions in concurrent code
- Unhandled async errors (promises, goroutines, tasks)
- Missing error boundaries at system edges

Use your knowledge of the detected language's idiomatic error handling patterns to find violations.

#### Code Quality Agent
- Dead code: unused exports, unreachable branches, commented-out code blocks
- Duplication: >10 lines repeated 3+ times
- Complexity: Functions >50 lines or deeply nested (>4 levels)
- Tech debt markers: TODO, FIXME, HACK, XXX, TEMP, WORKAROUND comments — list with context
- Test gaps: Critical paths (auth, payments, data mutations) without test coverage
- Naming inconsistencies within the same module
- Do NOT flag: style preferences, minor formatting, missing docstrings on internal code

## Phase 3 — Synthesis

After ALL agents complete, produce a unified report:

### Executive Summary
1. **Overall Health Score**: Weighted average across categories (security issues weigh 2x)
2. **Top 5 Critical Findings**: The most impactful issues across all categories, with file:line references
3. **Systemic Patterns**: Issues that appear repeatedly (these indicate process/knowledge gaps, not just bugs)
4. **Prioritized Action Plan**: What to fix first and why, grouped into:
   - **Fix immediately** (security critical, data loss risk)
   - **Fix this sprint** (high-severity, architectural drift)
   - **Plan for** (tech debt, quality improvements)
5. **What's Working Well**: Positive patterns and strengths worth preserving

Write the full report to `AUDIT-REPORT.md` in the project root.

## Important Guidelines

- Do NOT flag generated code, vendored dependencies, or build artifacts
- Do NOT flag style issues — only flag things that affect correctness, security, or maintainability
- Every finding MUST include a file path and line number
- Every finding MUST include a concrete fix suggestion (not just "fix this")
- If the codebase is massive (1000+ files), focus agents on the highest-risk surface area identified in Phase 0 (entry points, auth, data handling) rather than trying to cover everything
- For small codebases (<50 files), agents can be thorough — cover everything
- For medium codebases, prioritize but aim for good coverage
