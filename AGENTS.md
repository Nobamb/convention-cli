# Repository Guidelines

## Project Structure & Module Organization

This repository currently contains planning documentation under `init/`. `init/prd.md` describes the product requirements for Convention CLI, and `init/structure.md` describes the intended Node.js CLI layout.

The planned implementation structure is:

- `bin/` for the executable CLI entry point, such as `bin/convention.js`.
- `src/commands/` for command handlers (`commit`, `config`, `model`).
- `src/core/` for shared business logic, including Git operations, prompt construction, and AI orchestration.
- `src/providers/` for AI provider integrations.
- `src/auth/`, `src/config/`, and `src/utils/` for authentication, persisted settings, and common helpers.
- Tests should mirror source modules under `test/` or `tests/` once the implementation is added.

## Build, Test, and Development Commands

No build or test scripts exist yet because the repository has not added `package.json`. When the Node.js CLI is scaffolded, prefer standard npm scripts:

- `npm install` installs local dependencies.
- `npm test` runs the test suite.
- `npm run lint` checks formatting and static rules.
- `node bin/convention.js --help` verifies the CLI entry point locally.
- `npm link` can be used to test the global `convention` command during development.

Update this section whenever scripts are added or renamed.

## Coding Style & Naming Conventions

Use JavaScript for the initial CLI implementation unless the project explicitly migrates to TypeScript. Prefer ES modules, 2-space indentation, semicolons only if the chosen formatter requires them, and clear file names such as `git.js`, `prompt.js`, and `openai-compatible.js`.

Keep command parsing in `bin/` or `src/commands/`; keep provider-specific API details inside `src/providers/`. Use `path`, `os`, and UTF-8-aware file handling for cross-platform behavior.

## Testing Guidelines

Add focused tests for Git command wrappers, config persistence, prompt generation, and provider routing. Test names should describe behavior, for example `generates batch commit message from staged diff`. Avoid real network calls in unit tests; mock AI providers and local LLM endpoints.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit style, especially `docs: ...`. Continue using `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, and `chore:` with concise imperative summaries.

Pull requests should include a short purpose statement, key implementation notes, test results, and linked issues when available. Include terminal output or screenshots only when they clarify CLI behavior.

## Security & Configuration Tips

Never commit API keys, OAuth tokens, or generated credentials. Store user configuration outside the repo, such as `~/.config/convention/config.json` and `~/.config/convention/credentials.json`.
