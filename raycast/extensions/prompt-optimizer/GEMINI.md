# Prompt Optimizer (Raycast Extension)

## Project Overview
**Prompt Optimizer** is a Raycast extension designed to refine and enhance user prompts using various AI CLI tools. It takes a raw user prompt and transforms it into a structured, professional specification using models like Gemini, Claude, Codex, and Opencode.

## Architecture
The project is built using the **Raycast API** with **React** and **TypeScript**.

### Key Components
- **`src/optimize-prompt.tsx`**: The primary command. It renders a form for inputting the prompt, selecting the AI engine/model, and displaying the optimized result. It also handles saving to history.
- **`src/history.tsx`**: A separate command view to list, search, and manage the history of optimized prompts.
- **`src/utils/engines.ts`**: Defines the available AI engines (`codex`, `claude`, `gemini`, `opencode`), their available models, and the specific CLI commands used to invoke them. This file also contains the **System Prompt** used to instruct the AI on how to optimize the input.
- **`src/utils/exec.ts`**: A wrapper around `execa` to safely execute CLI commands, handling `PATH` injection (specifically for Homebrew), timeouts, and error parsing.
- **`src/utils/history.ts`**: Manages persistence of prompt history using Raycast's `LocalStorage`.

## Engines & CLI Integration
The extension relies on external CLI tools being installed and configured in the user's environment. It shells out to these CLIs to perform the actual inference.

| Engine | CLI Command | Default Model | Notes |
| :--- | :--- | :--- | :--- |
| **Codex** | `codex` | `gpt-5.1-codex-max` | Uses `model_reasoning_effort="medium"` |
| **Claude** | `claude` | `sonnet` | |
| **Gemini** | `gemini` | `gemini-3-pro-preview` | Passes prompt via `-p` flag |
| **Opencode** | `opencode` | `grok-code-fast-1` | |

## Development & Building

### Prerequisites
- Node.js (v18+)
- Raycast app installed
- Relevant CLI tools (`gemini`, `claude`, etc.) installed and authenticated

### Commands
- **Install Dependencies:** `npm install`
- **Start Development Server:** `npm run dev` (runs `ray develop`)
- **Build for Production:** `npm run build` (runs `ray build`)
- **Linting:** `npm run lint` (runs `ray lint`)
- **Fix Linting:** `npm run fix-lint`

### Conventions
- **Styling:** Prettier and ESLint are enforced via the Raycast configuration.
- **Imports:** Use absolute imports where possible or relative paths consistent with the directory structure.
- **State Management:** React `useState` and `useEffect` are used for local state; `LocalStorage` is used for persistence.

## Directory Structure
```
/src
  ├── optimize-prompt.tsx  # Main entry point for the "Optimize Prompt" command
  ├── history.tsx          # Entry point for the "View History" command
  ├── test-engines.ts      # Script for testing engine configurations
  └── /utils
      ├── engines.ts       # Engine definitions and prompt construction logic
      ├── exec.ts          # Shell execution wrapper
      └── history.ts       # LocalStorage management
```
