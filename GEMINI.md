# GEMINI.md

## Project Overview
**Convention CLI** is an AI-powered command-line tool designed to automate the Git commit workflow. It analyzes changes in a Git repository (via `git diff`) and uses Large Language Models (LLMs) to generate commit messages that follow the **Conventional Commits** standard.

### Key Features
- **AI-Powered Analysis:** Supports multiple providers including Gemini, Claude, OpenAI-compatible APIs, and local LLMs (Ollama, LM Studio). Providers are classified into Stable (Gemini, Github Copilot, Codex, Claude, Grok, Deepseek, Kimi, GLM, localLLM) and Experimental (Antigravity, Manus).
- **Multiple Modes:** 
  - `--step`: Iterates through changed files for individual commits.
  - `--batch`: Analyzes all changes for a single consolidated commit.
- **Workflow Automation:** Optional automatic `--push` after commit or `--reset` to undo the last commit.
- **Multilingual Support:** `--language` to support Korean (default), English, Japanese, and Chinese.
- **Cross-Platform:** Designed for Windows, macOS, and Linux.

---

## Technical Stack & Architecture
- **Runtime:** Node.js (ES Modules).
- **CLI Framework:** `commander` for argument parsing.
- **Interactive UI:** `prompts`, `chalk`, and `ora` for terminal visuals.
- **Core Architecture (`structure.md`):**
  - `bin/convention.js`: CLI entry point, argument parsing, and routing.
  - `src/commands/`: Command execution flow (`commit.js`, `config.js`, `model.js`, `help.js`).
  - `src/core/`: Core business logic (`git.js`, `prompt.js`, `ai.js`).
  - `src/providers/`: Specific AI implementations (`gemini.js`, `claude.js`, `localLLM.js`, etc.). Must remain isolated from `core/ai.js`.
  - `src/auth/`: Authentication strategies (`apiKey.js`, `oauth.js`).
  - `src/config/`: Configuration & credential persistence (`store.js`, `defaults.js`).
  - `src/utils/`: Common utilities (`logger.js`, `validator.js`, `ui.js`).

---

## AI Agent Development Rules (`00_rule.md`)

All AI Agents working on this project MUST strictly follow these rules:

### 1. Security & Privacy
- **DO NOT** output sensitive information, full diffs, API keys, OAuth tokens, or secrets to the log.
- **Filter Sensitive Files:** Always exclude files like `.env`, `*.pem`, `*.key`, `id_rsa`, `credentials.json` from AI diff analysis.
- **Detect Secrets in Diffs:** Before sending diffs to external APIs, detect and warn users about potential leaked secrets (`API_KEY`, `PASSWORD`, etc.).

### 2. Code Implementation Rules
- **ES Modules:** Use Node.js ESM (`import`/`export`).
- **Paths:** ALWAYS use `path.join()` and `os.homedir()` for path construction. Never concatenate with strings like `+ '/'`.
- **Git Execution:** NEVER use string interpolation with `execSync` for git commands (e.g., ``execSync(`git add ${file}`)``). ALWAYS use `execFileSync` or `spawnSync` with an array of arguments (e.g., `execFileSync("git", ["add", file])`).
- **Config Path:** Configuration should be read from/written to `~/.config/convention/config.json`.
- **Testing:** Git tests must run in isolated environments (e.g., `/tmp/convention-test-repo`), NOT within the real user repository. No automatic destructive commands without user confirmation.

### 3. Orchestration & MVP Phases (`01_mvp-1.md`)
- **Agent Separation:** Agents should be broken down into micro-tasks (e.g., "Help Output Agent", "Config Write Agent", "Git Diff Agent") rather than monolithic tasks ("Git Agent").
- **Implementation Sequence:**
  1. **Phase 1 (Foundation):** Basic CLI structure, `npm link`, and `--help` output.
  2. **Phase 2 (Config):** Read/write `config.json`, `--set-mode`, and `--language`.
  3. **Phase 3 (Git Analysis):** Repository validation, file list, and diff extraction (handling UTF-8 and `core.quotepath=false`).
  4. **Phase 4 (AI Integration):** Prompt generation and AI response cleaning (starting with a Mock AI provider).
  5. **Phase 5 (Commit Flow):** Git staging, AI message generation, user confirmation (`confirmBeforeCommit`), and final Git commit via `--batch` / `--step`.

---

## Key Documentation References
- `init/prd.md`: Full Product Requirement Document (Target features: step, batch, push, reset, model config, language).
- `init/structure.md`: Detailed module and directory structure planning (Why `core/ai.js` and `providers` are separated).
- `init/00_rule.md`: Core security, file exclusion, execution, and testing rules for AI agents.
- `init/01_mvp-1.md`: 1st MVP phased orchestration and micro-agent task definitions.
- `AGENTS.md`: High-level repository guidelines and AI instructions.
