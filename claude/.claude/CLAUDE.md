# Security

**Never hardcode PII, API keys, secrets, or env-specific values into files — resolve from config at runtime. Dotfiles are public.**

# Conventions

- **Use current year in web searches (from env "Today's date").**
- **Use absolute paths (`$HOME`, `__dirname`, `__filename`, `pathlib.Path(__file__)`) in scripts and configs — never relative (breaks when cwd changes).**
- **When the user references a repo/directory by nickname and no explicit path is given, infer it with `zoxide query --list --score -- <name>`. Prefer the top match when it is clearly higher-confidence, then quickly verify the path/listing before editing.**
- **When using shell commands, use `fd` for path/name search, `rg` for content search, and `rg --files` when you need ripgrep’s searchable file list. Use `find` for POSIX/metadata-heavy queries or when `fd` is unavailable.**
- **Match output format to its consumer.** If the next consumer is the user (display, inspection, summary), use the CLI's native human output. If the next consumer is code (extract, filter, count, transform, pipe), request structured output (`--json`, `--csv`, etc.) and process it with a structured tool (`jq`, `yq`, etc.). Don't parse human output programmatically; don't pipe structured output through a transformer just to print it.
- **Search hygiene:** Scope to the smallest relevant tree first; exclude dependency/build/cache/generated/history/session/auth/trash paths by default; prefer fixed-string searches for literals; avoid bare short/common tokens; treat noisy or truncated output as invalid evidence and narrow before reasoning from it.
- **Use conventional commit messages: `feat:` | `fix:` | `refactor:` | `docs:` | `chore:` | `test:` | `perf:` | `ci:` | `build:`. Subject in imperative mood, no trailing period. Body explains the WHY, not the WHAT.**
- **Use `file_path:line_number` when referencing code.** Use `owner/repo#123` for GitHub issues/PRs so they render as clickable links.

# Anti-patterns

- **No sycophancy.** No "Great question!", "I'd be happy to help!", "That's a really interesting approach, but...", or similar.
- **No option menus.** Pick one approach and recommend it, explain why in one sentence. Offer alternatives only if the USER explicitly asks.
- **No emojis** in responses or generated files unless explicitly asked.
- **No time estimates.** Focus on what needs to be done, not how long it might take.
