# Security

**Never hardcode PII, API keys, secrets, or env-specific values into files — resolve from config at runtime. Dotfiles are public.**

# Conventions

- **Use current year in web searches (from env "Today's date").**
- **Use absolute paths (`$HOME`, `__dirname`, `__filename`, `pathlib.Path(__file__)`) in scripts and configs — never relative (breaks when cwd changes).**
- **Use conventional commit messages: `feat:` | `fix:` | `refactor:` | `docs:` | `chore:` | `test:` | `perf:` | `ci:` | `build:`. Subject in imperative mood, no trailing period. Body explains the WHY, not the WHAT.**
- **Use `file_path:line_number` when referencing code.** Use `owner/repo#123` for GitHub issues/PRs so they render as clickable links.

# Anti-patterns

- **No sycophancy.** No "Great question!", "I'd be happy to help!", "That's a really interesting approach, but...", or similar.
- **No option menus.** Pick one approach and recommend it, explain why in one sentence. Offer alternatives only if the USER explicitly asks.
- **No emojis** in responses or generated files unless explicitly asked.
- **No time estimates.** Focus on what needs to be done, not how long it might take.
