# GEMINI.md

## Project Overview
**Convention CLI** is an AI-powered command-line tool designed to automate the Git commit workflow. It analyzes changes in a Git repository (via `git diff`) and uses Large Language Models (LLMs) to generate commit messages that follow the **Conventional Commits** standard.

### Key Features
- **AI-Powered Analysis:** Supports multiple providers including Gemini, Claude, OpenAI-compatible APIs, and local LLMs (Ollama, LM Studio).
- **Multiple Modes:** 
  - `--step`: Iterates through changed files for individual commits.
  - `--batch`: Analyzes all changes for a single consolidated commit.
- **Workflow Automation:** Optional automatic `push` after commit or `reset` to undo the last commit.
- **Multilingual Support:** Supports Korean (default), English, Japanese, and Chinese.
- **Cross-Platform:** Designed for Windows, macOS, and Linux.

---

## Technical Stack & Architecture
- **Runtime:** Node.js (Planned implementation in JavaScript with ES Modules).
- **CLI Framework:** `commander` for argument parsing.
- **Interactive UI:** `prompts`, `chalk`, and `ora` for terminal visuals.
- **Core Architecture:**
  - `bin/`: CLI entry point and routing.
  - `src/commands/`: Command logic for `commit`, `config`, and `model`.
  - `src/core/`: Business logic for Git operations, AI orchestration, and prompt building.
  - `src/providers/`: Specialized adapters for different AI services.
  - `src/auth/`: OAuth and API Key management.
  - `src/config/`: Configuration and credential persistence.

---

## Development Conventions

### Coding Style
- **Language:** JavaScript (ES Modules).
- **Indentation:** 2 spaces.
- **Naming:** Clear, descriptive filenames (e.g., `git.js`, `openai-compatible.js`).
- **Cross-Platform Safety:** Use the `path` and `os` modules for all file paths. Always use UTF-8 encoding for Git outputs.

### Git & Contribution
- **Commits:** Use Conventional Commit style (`feat:`, `fix:`, `docs:`, etc.).
- **Branching:** Work on feature branches and submit PRs with clear purpose statements.

### Security
- **Credentials:** Never commit API keys or tokens. Store them locally in `~/.config/convention/credentials.json`.
- **Ignore Files:** Ensure `.gitignore` and `.npmignore` are correctly configured to exclude sensitive data.

---

## Building and Running

> [!NOTE]
> This project is currently in the initialization phase. `package.json` and implementation files are pending.

### Planned Scripts
- `npm install`: Install dependencies.
- `npm test`: Run the test suite (mirroring `src/` under `test/`).
- `npm run lint`: Check code style and static analysis.
- `npm link`: Link the CLI for global local testing.
- `node bin/convention.js --help`: Verify the CLI entry point.

---

## Key Documentation
- `init/prd.md`: Full Product Requirement Document (Korean).
- `init/structure.md`: Detailed module and directory structure planning.
- `AGENTS.md`: High-level repository guidelines and AI instructions.
